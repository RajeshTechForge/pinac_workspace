import type { ReactNode } from "react";
import { motion } from "motion/react";

type FeatureGridCardProps = {
  icon: ReactNode;
  label: string;
  heading: string;
  body: string;
  visual: ReactNode;
  /** Stagger delay for scroll reveal (0-1 range) */
  revealDelay?: number;
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (custom: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      delay: custom * 0.12,
      ease: [0.25, 0.1, 0.25, 1.0] as const,
    },
  }),
};

export default function FeatureGridCard({
  icon,
  label,
  heading,
  body,
  visual,
  revealDelay = 0,
}: FeatureGridCardProps) {
  return (
    <motion.div
      custom={revealDelay}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      className="relative flex flex-col backdrop-blur-md border border-void-500/40 rounded-xl overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
    >
      {/* ---- Atmospheric pocket background ---- */}
      <div aria-hidden="true" className="card-pocket" />

      {/* ---- Content ---- */}
      <div className="relative z-10 flex flex-col h-full p-6 minor-md:p-8">
        <div className="flex gap-3 items-center mb-4">
          {/* Icon */}
          <div className="text-star-300 [&_svg]:w-5 [&_svg]:h-5">{icon}</div>
          {/* Feature label */}
          <span className="block font-mono text-[10px] tracking-[0.15em] uppercase text-star-400">
            {label}
          </span>
        </div>

        {/* Heading */}
        <h4 className="font-sans text-h5 font-medium text-star-100 mb-2.5 leading-snug">
          {heading}
        </h4>

        {/* Body */}
        <p className="font-sans text-sm minor-md:text-body text-star-300 leading-relaxed">
          {body}
        </p>

        {/* In-card visual */}
        <div className="mt-6 flex-1 flex flex-col">{visual}</div>
      </div>
    </motion.div>
  );
}
