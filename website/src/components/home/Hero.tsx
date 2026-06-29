import { motion } from "motion/react";
import { useEffect, useState } from "react";

const fadeUpVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (custom: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: custom * 0.15,
      duration: 0.9,
      ease: "easeOut",
    },
  }),
};

export default function Hero() {
  return (
    <div className="relative w-full flex flex-col items-center">
      {/* Fixed Text Block (stays pinned in background) */}
      <div className="fixed inset-0 w-full h-[85vh] z-0 flex flex-col items-center pt-44 px-4 sm:px-6 lg:px-8 pointer-events-none">
        <motion.div
          variants={fadeUpVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center w-full max-w-5xl mx-auto pointer-events-auto"
        >
          <motion.p
            variants={fadeUpVariants}
            className="font-mono text-xs sm:text-sm uppercase tracking-widest text-star-400 mb-6"
          >
            Local-First & Open Source
          </motion.p>

          <motion.h1
            variants={fadeUpVariants}
            className="font-sans text-4xl sm:text-5xl lg:text-6xl tracking-tight text-star-100 max-w-4xl leading-[1.1] mb-6 starlight-sheen"
          >
            Your chats stay yours.
          </motion.h1>

          <motion.p
            variants={fadeUpVariants}
            className="font-sans text-base sm:text-lg text-star-300 max-w-2xl leading-relaxed mb-10"
          >
            Chats are stored on your device. Your account and API keys are
            protected by an encrypted backend you never have to think about.
          </motion.p>

          <motion.div
            variants={fadeUpVariants}
            className="flex flex-col sm:flex-row items-center gap-6 mb-8"
          >
            {/* Primary CTA */}
            <motion.a
              href="#download"
              className="relative px-6 py-3 rounded-md bg-nebula/10 border border-nebula/30 text-star-100 font-sans font-medium overflow-hidden group"
              whileHover="hover"
            >
              <motion.div className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/20 to-transparent skew-x-12 translate-x-[150%] group-hover:animate-[sweep_0.6s_ease-out]" />
              Download for Linux
            </motion.a>

            {/* Secondary CTA */}
            <motion.a
              href="https://github.com/pinac-workspace"
              className="text-star-300 hover:text-star-100 font-sans font-medium transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-bottom-right after:scale-x-0 hover:after:origin-bottom-left hover:after:scale-x-100 after:bg-nebula/50 after:transition-transform after:duration-300"
            >
              View on GitHub
            </motion.a>
          </motion.div>

          <motion.div
            variants={fadeUpVariants}
            className="font-mono text-xs sm:text-sm text-star-400 flex items-center gap-3 opacity-80"
          >
            <span>MIT licensed</span>
            <span>·</span>
            <span>Local SQLite storage</span>
            <span>·</span>
            <span>Full model freedom</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Spacer to place the image well below the text on initial load */}
      <div className="w-full h-[85vh] shrink-0" />

      {/* Scrolling Product Visual (slides over text) */}
      <motion.div
        variants={fadeUpVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-300 mx-auto px-4 sm:px-6 lg:px-8 pb-32 fade-mask-bottom"
      >
        {/* Screenshot Area */}
        <div className="relative w-full overflow-hidden flex-1 bg-void-800">
          <img
            src="/app_screenshort.svg"
            alt="Pinac Workspace Interface"
            className="w-full h-auto object-cover opacity-95 block"
          />
        </div>
      </motion.div>
    </div>
  );
}
