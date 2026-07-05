import { motion } from "motion/react";
import {
  OpenAI,
  Claude,
  Gemini,
  Gemma,
  Grok,
  Minimax,
  DeepSeek,
  Kimi,
  Qwen,
  Mistral,
} from "@lobehub/icons";

type LogoItem = {
  id: string;
  Icon: React.ComponentType<{ size?: number }>;
  Text: React.ComponentType<{ size?: number }>;
};

const logos: LogoItem[] = [
  { id: "openai", Icon: OpenAI, Text: OpenAI.Text },
  { id: "claude", Icon: Claude, Text: Claude.Text },
  { id: "gemini", Icon: Gemini, Text: Gemini.Text },
  { id: "gemma", Icon: Gemma, Text: Gemma.Text },
  { id: "grok", Icon: Grok, Text: Grok.Text },
  { id: "minimax", Icon: Minimax, Text: Minimax.Text },
  { id: "deepseek", Icon: DeepSeek, Text: DeepSeek.Text },
  { id: "kimi", Icon: Kimi, Text: Kimi.Text },
  { id: "qwen", Icon: Qwen, Text: Qwen.Text },
  { id: "mistral", Icon: Mistral, Text: Mistral.Text },
];

type LogoCardProps = {
  item: LogoItem;
  index: number;
};

function LogoCard({ item, index }: LogoCardProps) {
  const { Icon, Text } = item;
  return (
    <div
      key={index}
      className="flex items-center gap-2 text-star-400 hover:text-star-200 transition-colors duration-300 opacity-50 hover:opacity-100 [&_svg_*]:fill-current! shrink-0 px-8 minor-sm:px-10"
    >
      <Icon size={30} />
      <Text size={24} />
    </div>
  );
}

export default function TrustedBy() {
  // Duplicate logos to create a seamless infinite loop
  const track = [...logos, ...logos];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.9, ease: "easeOut" }}
      className="w-full flex flex-col items-center pt-20 minor-xs:pt-24 pb-20 minor-xs:pb-20 relative z-10"
    >
      {/* Label */}
      <p className="font-mono text-[10px] minor-xs:text-xs minor-sm:text-sm tracking-widest uppercase text-star-400/80 mb-10 text-center">
        Integrates with
      </p>

      {/* Marquee — overflow hidden, no scrollbar */}
      <div
        className="w-full overflow-hidden relative"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
        }}
      >
        {/* Scrolling track: animate from 0 → -50%*/}
        <motion.div
          className="flex w-max"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: 40,
            ease: "linear",
            repeat: Infinity,
            repeatType: "loop",
          }}
        >
          {track.map((item, index) => (
            <LogoCard key={`${item.id}-${index}`} item={item} index={index} />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
