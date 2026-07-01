export function PageHeader({
  title,
  description
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </header>
  );
}
