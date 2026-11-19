import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_TRANSCRIPT_CHARS = 6000;

const DraftsSchema = z.object({
  messages: z.array(
    z.object({
      spoken_as: z
        .string()
        .describe('Who the message is for, as the speaker said it, e.g. "Hannah" or "my mother-in-law".'),
      person_id: z
        .string()
        .nullable()
        .describe("The id of the matching known person, or null if none clearly matches."),
      message: z.string().describe("The text message, written to the recipient."),
    }),
  ),
});

const SYSTEM = `You turn a short voice memo into text messages the speaker will send to friends and family.

The speaker talks while driving or doing the morning routine, so the memo rambles. Find each person they want to message and write one text per person.

Voice is the whole point. These texts must sound like the speaker wrote them on their own phone:
- Keep their own words, phrases, slang and energy ("sending so much love", "was like woah"). Do not polish, formalize, or make it sound nicer.
- Turn instructions into direct speech: "tell Hannah I've been thinking about her" becomes "I've been thinking about you".
- Only fix what's needed for it to read as a natural text: point of view, obvious dictation errors, basic punctuation.
- Do not add greetings, sign-offs, emojis, questions, or feelings the speaker didn't express.
- Keep it as short as what they said. Casual, lowercase-ok tone is fine if that's how they talk.

If the same person comes up more than once, combine it into one message. Skip anything that isn't meant to be sent to someone (notes to self, thinking out loud).

You'll get a list of people the speaker has saved, with ids, names and nicknames. If a recipient clearly matches one (including relationship words like "mother-in-law"), use that id. If it's ambiguous or unknown, use null. Never guess between two people.`;

type PersonIn = { id: string; name: string; aliases: string[] };

function unauthorized() {
  return Response.json({ error: "passcode" }, { status: 401 });
}

export async function POST(req: Request) {
  const passcode = process.env.APP_PASSCODE;
  if (passcode && req.headers.get("x-passcode") !== passcode) return unauthorized();

  let body: { transcript?: unknown; people?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) return Response.json({ error: "Nothing to draft — try talking again." }, { status: 400 });
  if (transcript.length > MAX_TRANSCRIPT_CHARS)
    return Response.json({ error: "That memo is too long. Try a shorter one." }, { status: 400 });

  const people: PersonIn[] = Array.isArray(body.people)
    ? (body.people as PersonIn[])
        .filter((p) => p && typeof p.id === "string" && typeof p.name === "string")
        .slice(0, 300)
        .map((p) => ({
          id: p.id,
          name: p.name.slice(0, 100),
          aliases: Array.isArray(p.aliases) ? p.aliases.filter((a) => typeof a === "string").slice(0, 20) : [],
        }))
    : [];

  const peopleList = people.length
    ? people
        .map((p) => `- id: ${p.id} | name: ${p.name}${p.aliases.length ? ` | also called: ${p.aliases.join(", ")}` : ""}`)
        .join("\n")
    : "(none saved yet)";

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json(
      { error: "The app isn't connected to Claude yet — add ANTHROPIC_API_KEY to its settings." },
      { status: 500 },
    );
  }

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // If the main model declines a request, the API retries it on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: betaZodOutputFormat(DraftsSchema),
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Saved people:\n${peopleList}\n\nVoice memo:\n<memo>\n${transcript}\n</memo>`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "Couldn't draft that one. Try saying it a different way." }, { status: 422 });
    }
    const parsed = response.parsed_output;
    if (!parsed) {
      return Response.json({ error: "Something went wrong drafting. Try again." }, { status: 502 });
    }

    const knownIds = new Set(people.map((p) => p.id));
    const messages = parsed.messages
      .filter((m) => m.message.trim())
      .map((m) => ({
        spoken_as: m.spoken_as.trim(),
        person_id: m.person_id && knownIds.has(m.person_id) ? m.person_id : null,
        message: m.message.trim(),
      }));

    return Response.json({ messages });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The app's Claude API key is missing or wrong." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Too many at once — wait a minute and try again." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Claude API error", error.status, error.message);
      return Response.json({ error: "Couldn't reach Claude. Try again in a moment." }, { status: 502 });
    }
    console.error(error);
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
