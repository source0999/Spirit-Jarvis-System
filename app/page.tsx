import VitalSigns from "@/components/VitalSigns";
import ProjectPortalWidget from "@/components/ProjectPortalWidget";
import StorageSentinel from "@/components/StorageSentinel";
import DashboardChatLauncher from "@/components/DashboardChatLauncher";
import SonicStatsWidget from "@/components/SonicStatsWidget";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#02040a] p-4 sm:p-6 md:p-6 font-mono text-slate-300">
      {/* Dynamic Header */}
      <div className="max-w-[1600px] mx-auto mb-6 md:mb-8 flex justify-between items-center border-b border-cyan-950/40 pb-4 md:pb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-cyan-400 italic">
            SPIRIT_OS{" "}
            <span className="text-[10px] sm:text-xs font-light not-italic text-cyan-800 ml-1 sm:ml-2 block sm:inline mt-1 sm:mt-0">
              NODE_SEED_01
            </span>
          </h1>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 mt-2">
            <span className="text-[10px] text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0" /> SYSTEM_NOMINAL
            </span>
            <span className="text-[10px] text-cyan-700 uppercase tracking-widest">Location: Georgia_Lab</span>
          </div>
        </div>
      </div>

      {/* md+: fixed 2×2 grid (280px rail + stable row heights) to avoid layout jump on refresh */}
      <div
        className={[
          "max-w-[1600px] mx-auto flex flex-col gap-6",
          "md:grid md:grid-cols-[minmax(0,1fr)_280px] md:grid-rows-[repeat(2,minmax(350px,auto))] md:gap-8 md:items-stretch",
        ].join(" ")}
      >
        <div className="min-h-[350px] min-w-0 flex flex-col md:min-h-0">
          <div className="h-full min-h-[350px] bg-gradient-to-br from-cyan-950/10 to-transparent border border-cyan-900/20 rounded-2xl p-4 sm:p-6 backdrop-blur-xl flex flex-col">
            <VitalSigns />
          </div>
        </div>

        <div className="min-h-[350px] min-w-0 flex flex-col md:min-h-0">
          <div className="h-full min-h-[350px] flex flex-col">
            <ProjectPortalWidget />
          </div>
        </div>

        <div className="min-h-[350px] min-w-0 flex flex-col gap-6 md:min-h-0">
          <div className="min-h-0 flex-1 flex flex-col min-h-[200px]">
            <DashboardChatLauncher />
          </div>
          <div className="min-h-0 flex-1 flex flex-col min-h-[200px]">
            <SonicStatsWidget />
          </div>
        </div>

        <div className="min-h-[350px] min-w-0 flex flex-col md:min-h-0">
          <div className="h-full min-h-[350px] flex flex-col">
            <StorageSentinel />
          </div>
        </div>
      </div>
    </main>
  );
}