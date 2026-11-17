// Today's date as YYYY-MM-DD in the user's own timezone (toISOString would use UTC,
// which is still "yesterday" in India until 5:30 am).
export const todayLocalISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
