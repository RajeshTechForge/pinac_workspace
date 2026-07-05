import type { ReactNode } from "react";
import { motion } from "motion/react";

type AnchorRowProps = {
  textSide: "left" | "right";
  icon: ReactNode;
  label: string;
  heading: string;
  body: string;
  visual: ReactNode;
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.25, 0.1, 0.25, 1.0] as const,
    },
  },
};

export default function AnchorRow({
  textSide,
  icon,
  label,
  heading,
  body,
  visual,
}: AnchorRowProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      className={`relative flex flex-col ${
        textSide === "left" ? "major-md:flex-row" : "major-md:flex-row-reverse"
      } backdrop-blur-md border border-void-500/40 rounded-xl overflow-hidden`}
    >
      {/* ---- Text side ---- */}
      <div className="relative z-10 w-full major-md:w-1/2 flex flex-col justify-center p-6 minor-md:p-10 major-md:p-12">
        <div className="flex gap-3 items-center mb-4">
          <div className="text-star-300 [&_svg]:w-5 [&_svg]:h-5">{icon}</div>
          <span className="block font-mono text-[10px] tracking-[0.15em] uppercase text-star-400">
            {label}
          </span>
        </div>

        <h3 className="font-sans text-h4 font-medium text-star-100 mb-3.5 leading-snug">
          {heading}
        </h3>

        <p className="font-sans text-body text-star-300 leading-relaxed max-w-lg">
          {body}
        </p>
      </div>

      {/* ---- Visual side ---- */}
      <div
        className={`relative z-10 w-full major-md:w-1/2 flex items-center justify-center p-6 minor-md:p-10 major-md:p-12 border-t border-void-500/20 ${
          textSide === "left"
            ? "major-md:border-t-0 major-md:border-l"
            : "major-md:border-t-0 major-md:border-r"
        }`}
      >
        {/* ---- Atmospheric pocket background ---- */}
        <div aria-hidden="true" className="card-pocket" />
        <div className="w-full h-full max-w-lg flex flex-col justify-cente">
          {visual}
        </div>
      </div>
    </motion.div>
  );
}
