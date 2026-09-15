"use client";

export default function DashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="grid min-h-[40vh] place-items-center bg-[#f6f8f5] px-6"><div className="max-w-md rounded-[1.5rem] border border-[#dce7e1] bg-white p-8 text-center shadow-[0_20px_60px_rgba(32,88,76,.08)]"><h1 className="text-2xl font-semibold text-[#18312c]">Layanan sedang tidak tersedia</h1><p className="mt-3 text-sm leading-6 text-[#60736e]">Silakan coba kembali beberapa saat lagi.</p><button type="button" onClick={retry} className="mt-6 rounded-xl bg-[#20584c] px-5 py-3 text-sm font-semibold text-white">Coba lagi</button></div></main>;
}
