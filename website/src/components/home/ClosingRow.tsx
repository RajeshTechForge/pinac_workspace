import { motion } from "motion/react";

export default function ClosingRow() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-16 minor-md:py-20 major-md:py-24"
    >
      <span className="font-mono text-sm minor-md:text-base text-star-400 tracking-wide">
        → See how the system is built
      </span>
    </motion.div>
  );
}
