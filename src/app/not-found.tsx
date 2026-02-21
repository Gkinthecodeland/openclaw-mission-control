export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="mt-2 text-foreground/60">Page not found</p>
      </div>
    </div>
  );
}
