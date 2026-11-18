import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../services/supabaseClient";

/**
 * Detail check for the complaint forms, like the one the chat runs.
 *
 * Before a form is filed, /api/agents/check-complaint asks whether it is a complaint with
 * enough detail (what, where, when). If not, the follow-up question is asked in the chatbot
 * popup. The person's answer is sent back here, added to the form's description
 * ("Additional details: Q: ... A: ..."), and the check runs again (at most 2 questions).
 * Then the person reviews the form and presses Submit themselves.
 *
 * The chatbot and the form talk through two window events:
 *   FOLLOWUP_ASK    form -> chatbot  { question } to ask, or { message } to just say something
 *   FOLLOWUP_ANSWER chatbot -> form  { question, answer }
 */
export const FOLLOWUP_ASK = "form-followup";
export const FOLLOWUP_ANSWER = "form-followup-answer";

const MAX_QUESTIONS = 2;
const DETAILS_HEADER = "Additional details:";

/** The description with one more question and answer added under "Additional details:". */
export function addFollowupToDescription(description, question, answer) {
  const base = (description || "").trimEnd();
  const entry = `Q: ${question}\nA: ${answer.trim()}`;
  return base.includes(DETAILS_HEADER) ? `${base}\n${entry}` : `${base}\n\n${DETAILS_HEADER}\n${entry}`;
}

/** Runs the check. Any failure counts as "enough detail": the check never blocks filing. */
async function checkComplaint(body) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/agents/check-complaint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { sufficient: true };
    return await res.json();
  } catch {
    return { sufficient: true };
  }
}

const say = (detail) => window.dispatchEvent(new CustomEvent(FOLLOWUP_ASK, { detail }));

/**
 * @param getContext  () => ({ description, location, date, project, lang }) for the form now
 * @param setDescription  (text) => void, writes the form's description field
 * @param skip  true when the check doesn't apply (e.g. the chat already checked this complaint)
 *
 * Returns:
 *   status        "idle" | "checking" | "asking" | "ready"
 *   beforeSubmit  async () => true when the form may be filed now
 *   reopenChat    asks the open question again in the chatbot
 *   fileWithout   lets the form be filed without answering
 */
export function useFormFollowup({ getContext, setDescription, skip = false }) {
  const [status, setStatus] = useState("idle");
  const statusRef = useRef("idle");
  const questionRef = useRef("");
  const followupsRef = useRef([]); // [{ question, answer }]
  const checkedTextRef = useRef(null); // description that passed (or was reviewed after the questions)
  const contextRef = useRef(getContext);
  useEffect(() => {
    contextRef.current = getContext;
  });

  const setBoth = useCallback((s) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const ask = useCallback((question) => {
    questionRef.current = question;
    setBoth("asking");
    say({ question });
  }, [setBoth]);

  const finish = useCallback((description) => {
    checkedTextRef.current = description.trim();
    questionRef.current = "";
    setBoth("ready");
    say({ message: "Thank you. I've added your answers to the complaint form. Please review it and press Submit." });
  }, [setBoth]);

  // Runs the check on this description, with the form's other fields and earlier answers
  const runCheck = useCallback(async (description) => {
    const ctx = contextRef.current();
    setBoth("checking");
    const result = await checkComplaint({
      description,
      lang: ctx.lang || "en",
      location: ctx.location || null,
      date: ctx.date || null,
      project: ctx.project || null,
      followups: followupsRef.current,
    });
    return result;
  }, [setBoth]);

  // The chatbot sends the person's answer back
  useEffect(() => {
    const onAnswer = async (e) => {
      if (statusRef.current !== "asking") return;
      const answer = (e.detail?.answer || "").trim();
      if (!answer) return;
      const question = questionRef.current;
      const description = addFollowupToDescription(contextRef.current().description, question, answer);
      setDescription(description);
      followupsRef.current = [...followupsRef.current, { question, answer }];

      if (followupsRef.current.length >= MAX_QUESTIONS) {
        finish(description);
        return;
      }
      const result = await runCheck(description);
      if (result.sufficient || !result.question) finish(description);
      else ask(result.question);
    };
    window.addEventListener(FOLLOWUP_ANSWER, onAnswer);
    return () => window.removeEventListener(FOLLOWUP_ANSWER, onAnswer);
  }, [runCheck, setDescription, ask, finish]);

  const beforeSubmit = useCallback(async () => {
    if (skip) return true;
    const description = (contextRef.current().description || "").trim();
    if (!description) return true; // the form's own required-field check handles this
    if (checkedTextRef.current === description) return true;
    if (statusRef.current === "asking") {
      say({ question: questionRef.current });
      return false;
    }
    const result = await runCheck(description);
    if (result.sufficient || !result.question) {
      checkedTextRef.current = description;
      setBoth("idle");
      return true;
    }
    if (followupsRef.current.length === 0) {
      say({ message: "Before your complaint is filed, a little more detail will help the team act on it quickly." });
    }
    ask(result.question);
    return false;
  }, [skip, runCheck, setBoth, ask]);

  const reopenChat = useCallback(() => {
    if (statusRef.current === "asking") say({ question: questionRef.current });
  }, []);

  const fileWithout = useCallback(() => {
    checkedTextRef.current = (contextRef.current().description || "").trim();
    questionRef.current = "";
    setBoth("idle");
    say({ message: "Okay. Your complaint is being filed with the details you gave." });
  }, [setBoth]);

  return { status, beforeSubmit, reopenChat, fileWithout };
}
