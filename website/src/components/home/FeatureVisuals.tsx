import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  FileText,
  Brain,
  ChevronDown,
  ArrowUp,
  Globe,
  Cpu,
  Puzzle,
  ShieldAlert,
  Terminal,
  Shield,
  Lock,
} from "lucide-react";
import { OpenAI, Claude, Gemini, Grok, Kimi, DeepSeek } from "@lobehub/icons";

/* ================================================================
   Security — Tauri two-layer architecture diagram
   Annotated boundary cross-section: WebView (top) / Rust (bottom)
   ================================================================ */

export function SecurityVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    // Setup IntersectionObserver to trigger the drawing sequence once
    // when the visual enters the viewport, keeping it highly lightweight
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const leftLayers = [
    {
      label: "Browser Chrome/UI",
      Icon: Globe,
      border: "var(--color-star-500)",
      text: "var(--color-star-400)",
      iconColor: "var(--color-star-400)",
    },
    {
      label: "Renderer Process",
      Icon: Cpu,
      border: "var(--color-star-400)",
      text: "var(--color-star-300)",
      iconColor: "var(--color-star-300)",
    },
    {
      label: "Extension APIs",
      Icon: Puzzle,
      border: "var(--color-star-400)",
      text: "var(--color-star-300)",
      iconColor: "var(--color-star-300)",
    },
    {
      label: "Third-Party Scripts",
      Icon: ShieldAlert,
      border: "var(--color-star-400)",
      text: "var(--color-star-300)",
      iconColor: "var(--color-star-300)",
    },
    {
      label: "App",
      Icon: Terminal,
      border: "var(--color-nebula)",
      text: "var(--color-star-100)",
      iconColor: "var(--color-nebula)",
    },
  ];

  const rightLayers = [
    null,
    null,
    null,
    {
      label: "Native Shell (Tauri)",
      Icon: Shield,
      border: "var(--color-comet)",
      text: "var(--color-star-100)",
      iconColor: "var(--color-comet)",
    },
    {
      label: "App",
      Icon: Terminal,
      border: "var(--color-nebula)",
      text: "var(--color-star-100)",
      iconColor: "var(--color-nebula)",
    },
  ];

  const seams = [72, 120, 168, 216];

  return (
    <div
      ref={containerRef}
      className="w-full h-full p-4 rounded-md flex flex-col justify-center items-center"
    >
      <svg
        viewBox="0 0 540 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto relative z-10"
        role="img"
        aria-label="Security architecture diagram comparing Tauri with browser-based apps"
      >
        {/* Outer diagram panel */}
        <rect x="0" y="0" width="540" height="280" rx="10" strokeWidth="1" />

        {/* Column Labels */}
        <motion.text
          x={135}
          y={20}
          textAnchor="middle"
          fill="var(--color-star-400)"
          className="font-mono text-[9px] tracking-wider uppercase font-semibold select-none"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 0.6 } : {}}
          transition={{ duration: 0.5 }}
        >
          Browser-based App
        </motion.text>
        <motion.text
          x={405}
          y={20}
          textAnchor="middle"
          fill="var(--color-star-400)"
          className="font-mono text-[9px] tracking-wider uppercase font-semibold select-none"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 0.6 } : {}}
          transition={{ duration: 0.5 }}
        >
          Pinac Workspace (Tauri)
        </motion.text>

        {/* Left Stack — Browser-based App */}
        {leftLayers.map((layer, idx) => {
          const y = 30 + idx * 48;
          const delay = idx * 0.08;

          return (
            <g key={`left-layer-${idx}`}>
              {/* Animated box border */}
              <motion.rect
                x={30}
                y={y}
                width={210}
                height={36}
                rx={6}
                fill="var(--color-void-800)"
                fillOpacity={0.6}
                stroke={layer.border}
                strokeWidth={1.2}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={
                  isInView
                    ? { pathLength: 1, opacity: 1 }
                    : { pathLength: 0, opacity: 0 }
                }
                transition={{
                  pathLength: { duration: 0.6, delay, ease: "easeOut" },
                  opacity: { duration: 0.3, delay },
                }}
              />
              {/* Fade-in Content */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: delay + 0.3, duration: 0.3 }}
              >
                <foreignObject x={30} y={y} width={210} height={36}>
                  <div className="w-full h-full flex items-center gap-2 font-mono select-none px-3">
                    <layer.Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: layer.iconColor }}
                    />
                    <span
                      className="text-[10px] font-medium leading-none"
                      style={{ color: layer.text }}
                    >
                      {layer.label}
                    </span>
                  </div>
                </foreignObject>
              </motion.g>
            </g>
          );
        })}

        {/* Right Stack — Tauri App */}
        {rightLayers.map((layer, idx) => {
          if (!layer) return null;
          const y = 30 + idx * 48;
          // Stagger right stack layers simultaneously but stop after 2 layers.
          // Native Shell starts at 0s, App starts at 0.08s
          const delay = idx === 3 ? 0 : 0.08;

          return (
            <g key={`right-layer-${idx}`}>
              {/* Animated box border */}
              <motion.rect
                x={300}
                y={y}
                width={210}
                height={36}
                rx={6}
                fill="var(--color-void-800)"
                fillOpacity={0.6}
                stroke={layer.border}
                strokeWidth={1.2}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={
                  isInView
                    ? { pathLength: 1, opacity: 1 }
                    : { pathLength: 0, opacity: 0 }
                }
                transition={{
                  pathLength: { duration: 0.6, delay, ease: "easeOut" },
                  opacity: { duration: 0.3, delay },
                }}
              />
              {/* Fade-in Content */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: delay + 0.3, duration: 0.3 }}
              >
                <foreignObject x={300} y={y} width={210} height={36}>
                  <div className="w-full h-full flex items-center gap-2 font-mono select-none px-3">
                    <layer.Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: layer.iconColor }}
                    />
                    <span
                      className="text-[10px] font-medium leading-none"
                      style={{ color: layer.text }}
                    >
                      {layer.label}
                    </span>
                  </div>
                </foreignObject>
              </motion.g>
            </g>
          );
        })}

        {/* Risk / Attack Vector Dots on the Left Stack */}
        {seams.map((seamY, idx) => {
          const dotDelay = 1.0 + idx * 0.15;
          return (
            <g key={`seam-dot-${idx}`}>
              {/* Outer pulsing halo */}
              <motion.circle
                cx={135}
                cy={seamY}
                r="7"
                fill="var(--color-redshift)"
                initial={{ scale: 0, opacity: 0 }}
                animate={
                  isInView
                    ? {
                        scale: [1, 1.5, 1],
                        opacity: [0.15, 0.35, 0.15],
                      }
                    : {}
                }
                transition={
                  isInView
                    ? {
                        scale: {
                          delay: dotDelay,
                          duration: 2.0,
                          repeat: Infinity,
                          ease: "easeInOut",
                        },
                        opacity: {
                          delay: dotDelay,
                          duration: 2.0,
                          repeat: Infinity,
                          ease: "easeInOut",
                        },
                      }
                    : {}
                }
              />
              {/* Inner danger dot */}
              <motion.circle
                cx={135}
                cy={seamY}
                r="3"
                fill="var(--color-redshift)"
                initial={{ scale: 0, opacity: 0 }}
                animate={
                  isInView
                    ? {
                        scale: [1, 1.25, 1],
                        opacity: [0.8, 1, 0.8],
                      }
                    : {}
                }
                transition={
                  isInView
                    ? {
                        scale: {
                          delay: dotDelay + 0.1,
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        },
                        opacity: {
                          delay: dotDelay + 0.1,
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        },
                      }
                    : {}
                }
              />
            </g>
          );
        })}

        {/* Horizontal Guide Line sweeping across App layers */}
        <motion.line
          x1="30"
          y1={240}
          x2="510"
          y2={240}
          stroke="var(--color-comet)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isInView ? { pathLength: 1, opacity: [0, 0.8, 0.8, 0] } : {}}
          transition={
            isInView
              ? {
                  pathLength: { delay: 2.2, duration: 1.2, ease: "easeInOut" },
                  opacity: {
                    delay: 2.2,
                    duration: 1.2,
                    ease: "easeInOut",
                    times: [0, 0.1, 0.9, 1],
                  },
                  repeat: Infinity,
                  repeatDelay: 3.0,
                }
              : {}
          }
        />
      </svg>

      {/* Cross-fading Caption */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 2.8, duration: 0.8 }}
        className="mt-4 font-sans italic text-xs text-center text-star-300 relative z-10 select-none"
      >
        "The attack surface is reduced by what was never added."
      </motion.p>
    </div>
  );
}

/* ================================================================
   Local Chat History — device + database + crossed-out cloud
   ================================================================ */
export function LocalHistoryVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    // Setup IntersectionObserver to trigger the drawing sequence once
    // when the visual enters the viewport, keeping it highly lightweight
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full p-4 rounded-md flex flex-col justify-center items-center relative overflow-hidden"
    >
      <svg
        viewBox="0 0 540 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto relative z-10"
        role="img"
        aria-label="Local storage diagram showing messages staying on-device and not syncing to the cloud"
      >
        {/* Outer diagram panel */}
        <rect x="0" y="0" width="540" height="280" rx="10" strokeWidth="1" />

        {/* Top: Wireframe Cloud Outline (Static reference, dashed, 30% opacity) */}
        <g transform="translate(210, 30)">
          <path
            d="M60 65 C60 48 50 35 35 35 C35 18 50 5 70 5 C85 5 98 14 102 28 C110 25 120 30 120 42 C120 56 108 65 95 65 Z"
            stroke="var(--color-star-400)"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            opacity="0.3"
            fill="none"
          />
        </g>

        {/* Bottom Center: Compact Device Outline (laptop) */}
        {/* Screen Outer */}
        <motion.rect
          x={210}
          y={170}
          width={120}
          height={76}
          rx={4}
          stroke="var(--color-star-300)"
          strokeWidth="1.5"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={isInView ? { pathLength: 1 } : {}}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {/* Keyboard Base */}
        <motion.path
          d="M 195 246 L 345 246 L 340 252 L 200 252 Z"
          stroke="var(--color-star-300)"
          strokeWidth="1.5"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={isInView ? { pathLength: 1 } : {}}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />

        {/* Left Side: SQLite DB Cylinder */}
        <g transform="translate(80, 175)" opacity={0.85}>
          {/* Cylinder Top Ellipse */}
          <motion.ellipse
            cx={30}
            cy={10}
            rx={25}
            ry={8}
            stroke="var(--color-star-300)"
            strokeWidth="1.2"
            fill="none"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.4, duration: 0.4 }}
          />
          {/* Cylinder Body */}
          <motion.rect
            x={5}
            y={10}
            width={50}
            height={35}
            stroke="var(--color-star-300)"
            strokeWidth="1.2"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
          />
          {/* Cylinder Bottom Ellipse */}
          <motion.ellipse
            cx={30}
            cy={45}
            rx={25}
            ry={8}
            stroke="var(--color-star-300)"
            strokeWidth="1.2"
            fill="none"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.4 }}
          />
          {/* Cylinder Inner Division Ellipses */}
          <motion.ellipse
            cx={30}
            cy={22}
            rx={25}
            ry={8}
            stroke="var(--color-star-400)"
            strokeWidth="1.0"
            strokeDasharray="2 2"
            fill="none"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 0.6 } : {}}
            transition={{ delay: 0.6, duration: 0.4 }}
          />
          <motion.ellipse
            cx={30}
            cy={34}
            rx={25}
            ry={8}
            stroke="var(--color-star-400)"
            strokeWidth="1.0"
            strokeDasharray="2 2"
            fill="none"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 0.6 } : {}}
            transition={{ delay: 0.6, duration: 0.4 }}
          />
        </g>
        <motion.text
          x={110}
          y={242}
          textAnchor="middle"
          fill="var(--color-star-200)"
          className="font-mono text-[8px] tracking-wider uppercase font-semibold select-none"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 0.85 } : {}}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          SQLite DB
        </motion.text>

        {/* Right Side: Local Documents */}
        <g opacity={0.85}>
          {/* Document 1 */}
          <motion.rect
            x={405}
            y={175}
            width={32}
            height={42}
            rx={3}
            stroke="var(--color-star-300)"
            strokeWidth="1.2"
            fill="var(--color-void-800)"
            fillOpacity={0.8}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
          />
          {/* Document 1 content lines */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 0.6 } : {}}
            transition={{ delay: 0.9, duration: 0.4 }}
            stroke="var(--color-star-400)"
            strokeWidth="1"
          >
            <line x1={411} y1={183} x2={431} y2={183} />
            <line x1={411} y1={191} x2={425} y2={191} />
            <line x1={411} y1={199} x2={429} y2={199} />
          </motion.g>

          {/* Document 2 (stacked slightly behind) */}
          <motion.rect
            x={420}
            y={182}
            width={32}
            height={42}
            rx={3}
            stroke="var(--color-star-300)"
            strokeWidth="1.2"
            fill="var(--color-void-800)"
            fillOpacity={0.8}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
          />
          {/* Document 2 content lines */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 0.6 } : {}}
            transition={{ delay: 1.0, duration: 0.4 }}
            stroke="var(--color-star-400)"
            strokeWidth="1"
          >
            <line x1={426} y1={190} x2={446} y2={190} />
            <line x1={426} y1={198} x2={440} y2={198} />
            <line x1={426} y1={206} x2={444} y2={206} />
          </motion.g>
        </g>
        <motion.text
          x={436}
          y={242}
          textAnchor="middle"
          fill="var(--color-star-200)"
          className="font-mono text-[8px] tracking-wider uppercase font-semibold select-none"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 0.85 } : {}}
          transition={{ delay: 0.8, duration: 0.4 }}
        >
          Local Files
        </motion.text>

        {/* Connection Lines (Laptop -> Storage) */}
        <motion.line
          x1={135}
          y1={208}
          x2={210}
          y2={208}
          stroke="var(--color-star-500)"
          strokeWidth="1"
          strokeDasharray="4 3"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 0.4 } : {}}
          transition={{ delay: 0.7, duration: 0.5 }}
        />
        <motion.line
          x1={330}
          y1={208}
          x2={405}
          y2={208}
          stroke="var(--color-star-500)"
          strokeWidth="1"
          strokeDasharray="4 3"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 0.4 } : {}}
          transition={{ delay: 0.8, duration: 0.5 }}
        />

        {/* Pulsing Local Data Packets */}
        <motion.circle
          cx={210}
          cy={208}
          r={2}
          fill="var(--color-nebula)"
          initial={{ opacity: 0 }}
          animate={
            isInView ? { cx: [210, 135], opacity: [0, 0.8, 0.8, 0] } : {}
          }
          transition={
            isInView
              ? {
                  cx: {
                    delay: 1.5,
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                  opacity: {
                    delay: 1.5,
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.2, 0.8, 1],
                  },
                }
              : {}
          }
        />
        <motion.circle
          cx={330}
          cy={208}
          r={2}
          fill="var(--color-nebula)"
          initial={{ opacity: 0 }}
          animate={
            isInView ? { cx: [330, 405], opacity: [0, 0.8, 0.8, 0] } : {}
          }
          transition={
            isInView
              ? {
                  cx: {
                    delay: 2.0,
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                  opacity: {
                    delay: 2.0,
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.2, 0.8, 1],
                  },
                }
              : {}
          }
        />

        {/* Message Bubble 1 */}
        <motion.g
          initial={{ opacity: 0, y: 235 }}
          animate={isInView ? { opacity: 1, y: [235, 120, 226] } : {}}
          transition={
            isInView
              ? {
                  y: {
                    delay: 0.8,
                    duration: 1.0,
                    times: [0, 0.45, 1],
                    ease: ["easeOut", "easeIn"],
                  },
                  opacity: { delay: 0.8, duration: 0.3 },
                }
              : {}
          }
          className="text-star-400"
        >
          {/* Bubble body */}
          <rect
            x={220}
            y={0}
            width={64}
            height={14}
            rx={3}
            stroke="currentColor"
            strokeWidth="1"
            fill="var(--color-void-800)"
            fillOpacity={0.8}
          />
          {/* Inner text lines */}
          <line
            x1={225}
            y1={5}
            x2={255}
            y2={5}
            stroke="currentColor"
            strokeWidth="1"
            opacity={0.6}
          />
          <line
            x1={225}
            y1={9}
            x2={245}
            y2={9}
            stroke="currentColor"
            strokeWidth="1"
            opacity={0.6}
          />
        </motion.g>

        {/* Message Bubble 2 */}
        <motion.g
          initial={{ opacity: 0, y: 235 }}
          animate={isInView ? { opacity: 1, y: [235, 100, 208] } : {}}
          transition={
            isInView
              ? {
                  y: {
                    delay: 1.3,
                    duration: 1.0,
                    times: [0, 0.45, 1],
                    ease: ["easeOut", "easeIn"],
                  },
                  opacity: { delay: 1.3, duration: 0.3 },
                }
              : {}
          }
          className="text-nebula"
        >
          {/* Bubble body */}
          <rect
            x={256}
            y={0}
            width={64}
            height={14}
            rx={3}
            stroke="currentColor"
            strokeWidth="1"
            fill="var(--color-void-800)"
            fillOpacity={0.8}
          />
          {/* Inner text lines */}
          <line
            x1={261}
            y1={5}
            x2={291}
            y2={5}
            stroke="currentColor"
            strokeWidth="1"
            opacity={0.7}
          />
          <line
            x1={261}
            y1={9}
            x2={281}
            y2={9}
            stroke="currentColor"
            strokeWidth="1"
            opacity={0.7}
          />
        </motion.g>

        {/* Message Bubble 3 */}
        <motion.g
          initial={{ opacity: 0, y: 235 }}
          animate={isInView ? { opacity: 1, y: [235, 80, 190] } : {}}
          transition={
            isInView
              ? {
                  y: {
                    delay: 1.8,
                    duration: 1.0,
                    times: [0, 0.45, 1],
                    ease: ["easeOut", "easeIn"],
                  },
                  opacity: { delay: 1.8, duration: 0.3 },
                }
              : {}
          }
          className="text-star-400"
        >
          {/* Bubble body */}
          <rect
            x={220}
            y={0}
            width={64}
            height={14}
            rx={3}
            stroke="currentColor"
            strokeWidth="1"
            fill="var(--color-void-800)"
            fillOpacity={0.8}
          />
          {/* Inner text lines */}
          <line
            x1={225}
            y1={5}
            x2={250}
            y2={5}
            stroke="currentColor"
            strokeWidth="1"
            opacity={0.6}
          />
          <line
            x1={225}
            y1={9}
            x2={240}
            y2={9}
            stroke="currentColor"
            strokeWidth="1"
            opacity={0.6}
          />
        </motion.g>

        {/* Lock Glyph (Fades in near the device and stays permanent) */}
        <motion.g
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 0.85, scale: 1 } : {}}
          transition={
            isInView
              ? {
                  delay: 2.6,
                  duration: 0.4,
                  ease: "easeOut",
                }
              : {}
          }
        >
          <foreignObject x={345} y={190} width={18} height={18}>
            <Lock className="w-4 h-4 text-nebula" strokeWidth={1.5} />
          </foreignObject>
        </motion.g>
      </svg>

      {/* Cross-fading Caption */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 3.2, duration: 0.8 }}
        className="mt-4 font-sans italic text-xs text-center text-star-300 relative z-10 select-none"
      >
        "Your history lives on your machine."
      </motion.p>
    </div>
  );
}

/* ================================================================
   Model Freedom — AI model grid
   ================================================================ */
export function ModelFreedomVisual() {
  const colorMap = {
    nebula: {
      selected:
        "border-nebula/50 bg-nebula/10 shadow-[0_0_15px_rgba(130,170,255,0.15)]",
      hover: "hover:border-nebula/60",
      text: "text-nebula",
      radioBorder: "border-nebula",
      radioBg: "bg-nebula/20",
      dot: "bg-nebula",
    },
    aurora: {
      selected:
        "border-aurora/50 bg-aurora/10 shadow-[0_0_15px_rgba(157,134,214,0.15)]",
      hover: "hover:border-aurora/60",
      text: "text-aurora",
      radioBorder: "border-aurora",
      radioBg: "bg-aurora/20",
      dot: "bg-aurora",
    },
    comet: {
      selected:
        "border-comet/50 bg-comet/10 shadow-[0_0_15px_rgba(92,192,196,0.15)]",
      hover: "hover:border-comet/60",
      text: "text-comet",
      radioBorder: "border-comet",
      radioBg: "bg-comet/20",
      dot: "bg-comet",
    },
    redshift: {
      selected:
        "border-redshift/50 bg-redshift/10 shadow-[0_0_15px_rgba(199,93,111,0.15)]",
      hover: "hover:border-redshift/60",
      text: "text-redshift",
      radioBorder: "border-redshift",
      radioBg: "bg-redshift/20",
      dot: "bg-redshift",
    },
    pulsar: {
      selected:
        "border-pulsar/50 bg-pulsar/10 shadow-[0_0_15px_rgba(124,224,176,0.15)]",
      hover: "hover:border-pulsar/60",
      text: "text-pulsar",
      radioBorder: "border-pulsar",
      radioBg: "bg-pulsar/20",
      dot: "bg-pulsar",
    },
    supernova: {
      selected:
        "border-supernova/50 bg-supernova/10 shadow-[0_0_15px_rgba(224,168,100,0.15)]",
      hover: "hover:border-supernova/60",
      text: "text-supernova",
      radioBorder: "border-supernova",
      radioBg: "bg-supernova/20",
      dot: "bg-supernova",
    },
  };

  const aiModels = [
    {
      id: "openai",
      name: "OpenAI",
      version: "GPT-5.5",
      desc: "Great for general tasks, reasoning, and creative writing.",
      Icon: OpenAI,
      selected: false,
      theme: colorMap.pulsar,
    },
    {
      id: "claude",
      name: "Claude",
      version: "Claude Sonnet 5",
      desc: "Excellent for analysis, writing, and complex reasoning.",
      Icon: Claude,
      selected: true,
      theme: colorMap.supernova,
    },
    {
      id: "gemini",
      name: "Google Gemini",
      version: "Gemini 3.5 Flash",
      desc: "Built for multimodal understanding and long-context tasks.",
      Icon: Gemini,
      selected: false,
      theme: colorMap.nebula,
    },
    {
      id: "grok",
      name: "Grok",
      version: "Grok 4.3",
      desc: "Real-time knowledge and insightful answers.",
      Icon: Grok,
      selected: false,
      theme: colorMap.redshift,
    },
    {
      id: "kimi",
      name: "Kimi",
      version: "Kimi 2.6",
      desc: "Optimized for long documents and deep understanding.",
      Icon: Kimi,
      selected: false,
      theme: colorMap.comet,
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      version: "DeepSeek-V4",
      desc: "Strong in coding, math, and technical problem solving.",
      Icon: DeepSeek,
      selected: false,
      theme: colorMap.nebula,
    },
  ];

  return (
    <div
      className="w-full h-full p-3.5 rounded-md bg-cover bg-center bg-no-repeat relative overflow-hidden flex flex-col justify-center"
      style={{ backgroundImage: "url(/bg_3.jpeg)" }}
    >
      <div className="absolute inset-0" />
      <div className="grid grid-cols-2 gap-2 relative">
        {aiModels.map((model, idx) => (
          <div
            key={model.id}
            className={`relative flex items-center gap-2 p-1.5 rounded-sm border transition-all duration-300 cursor-pointer group ${
              model.selected
                ? model.theme.selected
                : `bg-void-700/40 border-void-500/30 ${model.theme.hover}`
            }`}
          >
            {/* Icon container */}
            <div
              className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center bg-void-800 border overflow-hidden transition-colors duration-300 ${
                model.selected
                  ? "border-void-400"
                  : "border-void-500/50 group-hover:border-void-400/80"
              }`}
            >
              <model.Icon
                size={16}
                className={`transition-all duration-300 ${
                  model.selected
                    ? "scale-110"
                    : "opacity-80 group-hover:opacity-100"
                }`}
              />
            </div>

            {/* Header Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h4
                className={`text-[14px] font-normal truncate leading-tight transition-colors duration-300 ${
                  model.selected
                    ? "text-star-100"
                    : "text-star-200 group-hover:text-star-100"
                }`}
              >
                {model.name}
              </h4>
              <div
                className={`text-[10px] truncate font-light tracking-wide transition-colors duration-300 ${
                  model.selected
                    ? model.theme.text
                    : "text-star-400 group-hover:text-star-300"
                }`}
              >
                {model.version}
              </div>
            </div>

            {/* Radio button mimicking */}
            <div
              className={`w-2.5 h-2.5 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-300 ${
                model.selected
                  ? `${model.theme.radioBorder} ${model.theme.radioBg}`
                  : "border-void-400 group-hover:border-void-300"
              }`}
            >
              {model.selected && (
                <div className={`w-1 h-1 rounded-full ${model.theme.dot}`} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   Minimalist Interface — mock input area with model + thinking chips
   ================================================================ */
export function MinimalistVisual() {
  return (
    <div
      className="w-full h-full p-3 pb-2 rounded-md bg-cover bg-center bg-no-repeat relative overflow-hidden flex flex-col justify-end"
      style={{ backgroundImage: "url(/bg_2.jpeg)" }}
    >
      {/* Outer input shell */}
      <div className="bg-void-700/80 border border-void-400/40 rounded-xl overflow-hidden shadow-[0_0_24px_rgba(10,11,20,0.6)]">
        {/* ── PDF attachment chip ─────────────────────────────── */}
        <div className="px-3 pt-2">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-void-600/60 border border-void-500/40 group">
            <FileText className="text-supernova" size={12} />
            <span className="text-[10px] font-mono text-supernova/80 leading-none">
              project_brief.pdf
            </span>
            {/* Remove × */}
            <span className="text-[10px] text-star-400 ml-0.5 leading-none">
              ×
            </span>
          </div>
        </div>

        {/* ── Query text + blinking cursor ────────────────────── */}
        <div className="px-3 pt-2 pb-2">
          <p className="font-sans text-[13px] text-star-200 leading-snug select-none">
            Draft a project status update for my manager.
          </p>
        </div>

        {/* ── Bottom toolbar ───────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          {/* Left: model + thinking chips */}
          <div className="flex items-center gap-1.5">
            {/* Model chip */}
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-void-600/50 border border-void-500/40 text-[10px] text-star-300 font-sans hover:border-nebula/30 transition-colors duration-200"
            >
              <Claude.Color
                size={10}
                className="font-mono shrink-0 opacity-80"
              />
              <span>Claude Sonnet 5</span>
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="none"
                className="opacity-50"
              >
                <path
                  d="M2 3l2 2 2-2"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Thinking mode chip */}
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-void-600/50 border border-aurora/30 text-[10px] text-aurora/80 font-sans hover:border-aurora/50 transition-colors duration-200"
            >
              <Brain size={10} />
              <span className="font-mono">Think: medium</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Right: send button */}
          <button
            type="button"
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-supernova/85 hover:bg-supernova transition-colors duration-200 shadow-[0_0_10px_rgba(224,168,100,0.35)]"
          >
            <ArrowUp size={18} className="text-void-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Lightweight — system resource monitor strip
   ================================================================ */
export function LightweightVisual() {
  const memoryData = [
    { label: "Your App", value: 120, bar: "████▏", primary: true },
    {
      label: "Electron A",
      value: 850,
      bar: "████████████████████▍",
      primary: false,
    },
    {
      label: "Electron B",
      value: 1050,
      bar: "████████████████████████▋",
      primary: false,
    },
    {
      label: "Web Wrapper",
      value: 900,
      bar: "█████████████████████▏",
      primary: false,
    },
  ];

  return (
    <div
      className="w-full h-full p-3 pb-2 rounded-md bg-cover bg-center bg-no-repeat relative overflow-hidden flex flex-col justify-end"
      style={{ backgroundImage: "url(/bg_4.jpeg)" }}
    >
      <div className="bg-void-700/80 border border-void-400/40 rounded-xl px-4 py-4 shadow-[0_0_24px_rgba(10,11,20,0.6)] flex flex-col gap-3 relative z-10">
        <div className="text-[10px] font-mono tracking-[0.2em] text-star-400 uppercase mb-0.5">
          RAM Footprint
        </div>

        {memoryData.map((item) => (
          <div key={item.label} className="flex items-center gap-3 group">
            {/* Label */}
            <span
              className={`font-mono text-[11px] w-20 shrink-0 truncate transition-colors ${
                item.primary
                  ? "text-star-100 font-medium"
                  : "text-star-400 group-hover:text-star-300"
              }`}
            >
              {item.label}
            </span>

            {/* ASCII Bar */}
            <div className="flex-1 flex items-center overflow-hidden">
              <span
                className={`font-mono text-[10px] tracking-tighter transition-colors ${
                  item.primary
                    ? "text-pulsar drop-shadow-[0_0_5px_rgba(124,224,176,0.5)]"
                    : "text-void-400/60 group-hover:text-void-400/80"
                }`}
              >
                {item.bar}
              </span>
            </div>

            {/* Value */}
            <span
              className={`font-mono text-[11px] w-14 text-right transition-colors ${
                item.primary
                  ? "text-pulsar font-medium"
                  : "text-star-400 group-hover:text-star-300"
              }`}
            >
              {item.value} MB
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   Robust Backend — endpoint representation
   ================================================================ */
export function BackendVisual() {
  return (
    <div
      className="w-full h-full p-3 pb-2 rounded-md bg-cover bg-center bg-no-repeat relative overflow-hidden flex flex-col justify-end"
      style={{ backgroundImage: "url(/bg_5.jpeg)" }}
    >
      <div className="bg-void-900/95 border border-void-500/40 rounded-xl p-3.5 shadow-[0_0_24px_rgba(10,11,20,0.6)] flex flex-col relative z-10 font-mono text-[10px] leading-relaxed">
        {/* Terminal Header */}
        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-void-700/60">
          <div className="w-2 h-2 rounded-full bg-redshift/80" />
          <div className="w-2 h-2 rounded-full bg-supernova/80" />
          <div className="w-2 h-2 rounded-full bg-pulsar/80" />
          <span className="ml-2 text-star-400/80 text-[9px]">server.log</span>
        </div>

        {/* Logs */}
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <span className="text-void-400 shrink-0">14:02:10</span>
            <span className="text-comet w-8 shrink-0">INFO</span>
            <span className="text-star-300 truncate">
              Started server [FastAPI]
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-void-400 shrink-0">14:02:11</span>
            <span className="text-comet w-8 shrink-0">INFO</span>
            <span className="text-star-300 truncate">
              Listening on <span className="text-nebula">port 8000</span>
            </span>
          </div>

          <div className="flex gap-2 mt-1">
            <span className="text-void-400 shrink-0">14:02:45</span>
            <span className="text-pulsar w-8 shrink-0">POST</span>
            <div className="flex flex-1 items-center justify-between min-w-0">
              <span className="text-star-200 truncate">/v1/chat</span>
              <div className="flex gap-1.5 shrink-0 ml-2">
                <span className="text-pulsar/90">200 OK</span>
                <span className="text-star-400 w-6 text-right">12ms</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <span className="text-void-400 shrink-0">14:03:02</span>
            <span className="text-supernova w-8 shrink-0">GET</span>
            <div className="flex flex-1 items-center justify-between min-w-0">
              <span className="text-star-200 truncate">/v1/models</span>
              <div className="flex gap-1.5 shrink-0 ml-2">
                <span className="text-pulsar/90">200 OK</span>
                <span className="text-star-400 w-6 text-right">4ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
