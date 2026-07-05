import { motion } from "motion/react";

type SectionHeaderProps = {
  eyebrow: string;
  heading: string;
  supporting?: string;
};

const sectionHeaderVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 10, filter: "blur(2px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1.0] as const,
    },
  },
};

export default function SectionHeader({
  eyebrow,
  heading,
  supporting,
}: SectionHeaderProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={sectionHeaderVariants}
      className="flex flex-col items-center text-center w-full max-w-3xl mx-auto mb-16 minor-md:mb-20 major-md:mb-24"
    >
      {/* Eyebrow */}
      <motion.span
        variants={childVariants}
        className="font-mono text-[11px] minor-xs:text-xs tracking-[0.2em] text-star-400 uppercase mb-5"
      >
        {eyebrow}
      </motion.span>

      {/* Section heading */}
      <motion.h2
        variants={childVariants}
        className="font-sans text-h2 font-medium text-star-100 mb-4"
      >
        {heading}
      </motion.h2>

      {/* Supporting sentence (optional) */}
      {supporting && (
        <motion.p
          variants={childVariants}
          className="font-sans text-body text-star-300 max-w-2xl leading-relaxed"
        >
          {supporting}
        </motion.p>
      )}
    </motion.div>
  );
}
