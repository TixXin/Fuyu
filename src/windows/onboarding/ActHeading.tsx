/** An act's title and one line under it. */
export function ActHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="onboarding__heading">
      <h1 className="onboarding__title">{title}</h1>
      <p className="onboarding__lead">{lead}</p>
    </div>
  );
}
