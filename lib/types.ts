export type Person = {
  id: string;
  name: string;
  /** Optional. Without a number, Send opens Messages and you pick the contact. */
  phone: string;
  /** Other ways you refer to them: "mother-in-law", "mil", "Han". */
  aliases: string[];
};

export type Draft = {
  id: string;
  /** How you referred to them in the memo, e.g. "my mother-in-law". */
  spokenAs: string;
  personId: string | null;
  message: string;
  createdAt: number;
  sentAt: number | null;
};

/** What the server returns for each message it found in the memo. */
export type DraftFromServer = {
  spoken_as: string;
  person_id: string | null;
  message: string;
};
