import {
  Lock,
  LaptopMinimalCheck,
  ArrowLeftRight,
  Layout,
  ChartLine,
  Server,
} from "lucide-react";
import { motion } from "motion/react";
import SectionHeader from "./SectionHeader";
import AnchorRow from "./AnchorRow";
import FeatureGridCard from "./FeatureGridCard";
import ClosingRow from "./ClosingRow";
import {
  SecurityVisual,
  LocalHistoryVisual,
  ModelFreedomVisual,
  MinimalistVisual,
  LightweightVisual,
  BackendVisual,
} from "./FeatureVisuals";

const sectionRevealVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export default function Features() {
  return (
    <section id="features" className="relative w-full">
      <div className="max-w-7xl mx-auto px-inline py-section">
        {/* ---- Section Opening ---- */}
        <SectionHeader
          eyebrow="Built Different"
          heading="Every decision made for focus, speed and privacy."
          supporting="Not features added to a template — constraints we built around from the start."
        />

        {/* ---- Tier 1: Anchor Pair ---- */}
        <div className="flex flex-col gap-5 minor-md:gap-6 mb-5 minor-md:mb-6">
          {/* Security-oriented Architecture (text-left / visual-right) */}
          <AnchorRow
            textSide="left"
            icon={<Lock strokeWidth={1.5} />}
            label="Security"
            heading="Architecture that doesn't ask for trust."
            body="Desktop-first means no browser context. No extension injections, no exposed keys in renderers, no third-party scripts. Tiny attack surface — because nothing extra was added."
            visual={<SecurityVisual />}
          />
          {/* Local Chat History (text-right / visual-left) */}
          <AnchorRow
            textSide="right"
            icon={<LaptopMinimalCheck strokeWidth={1.5} />}
            label="Local Storage"
            heading="Your history lives on your machine."
            body="Local-first chats via SQLite. No cloud, no external service. Your history stays on-device and offline. API keys encrypted — your data, your control."
            visual={<LocalHistoryVisual />}
          />
        </div>

        {/* ---- Tier 3: Supporting Grid ---- */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={sectionRevealVariants}
          className="grid grid-cols-1 tablet:grid-cols-2 gap-5 minor-md:gap-6"
        >
          <FeatureGridCard
            icon={<ArrowLeftRight strokeWidth={1.5} />}
            label="Model Freedom"
            heading="Any model. Your key."
            body="Connect any supported model provider — including those with extended thinking modes. No defaults forced, no vendor locked in."
            visual={<ModelFreedomVisual />}
            revealDelay={0}
          />
          <FeatureGridCard
            icon={<Layout strokeWidth={1.5} />}
            label="Minimalist Interface"
            heading="Nothing between you and the conversation."
            body="No dashboards. No telemetry prompts. No chrome fighting for attention. The interface stays invisible so you can focus on the work."
            visual={<MinimalistVisual />}
            revealDelay={1}
          />
          <FeatureGridCard
            icon={<ChartLine strokeWidth={1.5} />}
            label="Lightweight"
            heading="Low RAM footprint. Runs alongside everything else."
            body="Tauri's native architecture uses far less memory than Electron. Runs smoothly alongside your apps, editor and browser."
            visual={<LightweightVisual />}
            revealDelay={2}
          />
          <FeatureGridCard
            icon={<Server strokeWidth={1.5} />}
            label="Robust Backend"
            heading="A backend that stays out of the way too."
            body="Thin, fast FastAPI backend built to extend. Add endpoints, hook into your tools — open architecture that grows with you."
            visual={<BackendVisual />}
            revealDelay={3}
          />
        </motion.div>

        {/* ---- Tier 3: Closing Row ---- */}
        <ClosingRow />
      </div>
    </section>
  );
}
