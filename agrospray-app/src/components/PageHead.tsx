export function PageHead({ module, title, sub }: { module: string; title: string; sub: string }) {
  return (
    <div className="mx-0.5 mb-4 mt-6">
      <div className="upper">{module}</div>
      <h2 className="mb-0.5 mt-1 text-[25px] font-bold tracking-tight">{title}</h2>
      <div className="text-[13px] text-mut">{sub}</div>
    </div>
  );
}
