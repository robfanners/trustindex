export default function AdminHomePage() {
  return (
    <main className="p-10 space-y-6">
      <h1 className="text-3xl font-bold">Verisum Admin</h1>
      <div className="space-y-2">
        <a className="text-blue-600 underline" href="/admin/bootstrap">
          /admin/bootstrap
        </a>
        <a className="text-blue-600 underline" href="/admin/new-run">
          /admin/new-run
        </a>
        <a className="text-blue-600 underline" href="/debug">
          /debug
        </a>
      </div>
    </main>
  );
}
