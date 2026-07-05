import { motion } from "motion/react";
import { Download } from "lucide-react";

const fadeUpVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (custom: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: custom * 0.15,
      duration: 0.9,
      ease: "easeOut" as const,
    },
  }),
};

export default function Hero() {
  return (
    <div className="relative w-full flex flex-col items-center">
      {/* Text Block */}
      <div className="w-full flex flex-col items-center pt-24 minor-xs:pt-32 tablet:pt-40 major-sm:pt-44 pb-16 minor-xs:pb-24 px-inline">
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center w-full max-w-5xl mx-auto"
        >
          {/* Eyebrow — scales from xs at narrow to sm at minor-sm+ */}
          <motion.p
            variants={fadeUpVariants}
            className="font-mono text-[10px] minor-xs:text-xs minor-sm:text-sm uppercase tracking-widest text-star-400 mb-4 minor-xs:mb-6"
          >
            Local-First &amp; Open Source
          </motion.p>

          {/* Heading — fluid clamp() via text-h1, no discrete jumps */}
          <motion.h1
            variants={fadeUpVariants}
            className="font-sans text-h1 tracking-tight text-star-100 max-w-4xl mb-4 minor-xs:mb-6 starlight-sheen"
          >
            Your chats stay yours.
          </motion.h1>

          {/* Body copy — fluid clamp() via text-body */}
          <motion.p
            variants={fadeUpVariants}
            className="font-sans text-sm minor-xs:text-body text-star-300 max-w-2xl mb-8 minor-xs:mb-10"
          >
            Chats are stored on your device. Your account and API keys are
            protected by an encrypted backend you never have to think about.
          </motion.p>

          {/* CTA group — stacks on mobile, goes row at minor-sm (480px) */}
          <motion.div
            variants={fadeUpVariants}
            className="flex flex-col minor-sm:flex-row items-center gap-4 minor-xs:gap-6 mb-6 minor-xs:mb-8"
          >
            {/* Primary CTA */}
            <motion.a
              href="#download"
              className="relative flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-nebula/10 hover:bg-nebula/15 border border-nebula/30 hover:border-nebula/50 text-star-200 hover:text-star-100 font-sans font-medium overflow-hidden group"
              whileHover="hover"
            >
              <motion.div className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/20 to-transparent skew-x-12 translate-x-[150%]" />
              <Download className="w-4 h-4" />
              Download now
            </motion.a>

            {/* Secondary CTA */}
            <motion.a
              href="https://github.com/RajeshTechForge/pinac_workspace"
              className="text-star-300 hover:text-star-100 font-sans font-medium transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-bottom-right after:scale-x-0 hover:after:origin-bottom-left hover:after:scale-x-100 after:bg-nebula/50 after:transition-transform after:duration-300"
            >
              View on GitHub
            </motion.a>
          </motion.div>

          {/* Meta row — same minor-sm text-size step */}
          <motion.div
            variants={fadeUpVariants}
            className="font-mono text-xs minor-sm:text-sm text-star-400 flex items-center gap-2 minor-md:gap-3 opacity-80"
          >
            <span>MIT licensed</span>
            <span>·</span>
            <span>Local SQLite storage</span>
            <span>·</span>
            <span>Full model freedom</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Product Visual */}
      <motion.div
        variants={fadeUpVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-7xl mx-auto px-inline"
      >
        {/* Atmospheric glow behind the screenshot — three blurred orbs */}
        <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden rounded-2xl">
          {/* Nebula blue — top-left */}
          <div className="absolute -top-16 -left-16 rounded-full bg-nebula/20 blur-[90px]" />
          {/* Aurora purple — bottom-right */}
          <div className="absolute -bottom-16 -right-16 rounded-full bg-aurora/15 blur-[80px]" />
          {/* Comet teal — centre */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35%] h-[35%] rounded-full bg-comet/10 blur-[70px]" />
        </div>

        {/* Bordered screenshot frame */}
        <div
          className="relative w-full rounded-xl overflow-hidden
                        border border-nebula/20
                        ring-1 ring-inset ring-white/5
                        shadow-[0_0_60px_-12px_rgba(130,170,255,0.25),0_0_120px_-24px_rgba(157,134,214,0.15)]"
        >
          {/* Thin top-edge highlight — gives the frame a "glass" feel */}
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-nebula/40 to-transparent pointer-events-none z-10" />

          <img
            src="/app_screenshot.svg"
            alt="Pinac Workspace Interface"
            className="w-full h-auto object-cover block"
          />
        </div>
      </motion.div>
    </div>
  );
}
