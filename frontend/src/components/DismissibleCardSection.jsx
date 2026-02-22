export default function DismissibleCardSection({
  title,
  className = "",
  children,
}) {
  return (
    <section className={`dismissible-section ${className}`.trim()}>
      <div className="dismissible-head">
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}
