import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        subtle: v("subtle"),
        line: v("line"),
        "line-strong": v("line-strong"),
        ink: v("ink"),
        "ink-2": v("ink-2"),
        "ink-3": v("ink-3"),
        inverse: v("inverse"),
        "inverse-ink": v("inverse-ink"),
        accent: v("accent"),
        "accent-ink": v("accent-ink"),
        good: v("good"),
        warn: v("warn"),
        danger: v("danger"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: {
        page: "1200px",
      },
      borderRadius: {
        md: "10px",
        lg: "16px",
        xl: "20px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
        pop: "var(--shadow-pop)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(.16,1,.3,1)",
        spring: "cubic-bezier(.34,1.56,.64,1)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "page-in": {
          from: { opacity: "0", transform: "translateY(10px)", filter: "blur(4px)" },
          to: { opacity: "1", transform: "none", filter: "none" },
        },
        "pop-in": {
          from: { opacity: "0", transform: "translateY(-4px) scale(.96)" },
          to: { opacity: "1", transform: "none" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(16px) scale(.94)" },
          to: { opacity: "1", transform: "none" },
        },
        "msg-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(.97)" },
          to: { opacity: "1", transform: "none" },
        },
        "row-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        print: {
          from: { clipPath: "inset(-40% -40% 100% -40%)", transform: "translateY(-14px)" },
          to: { clipPath: "inset(-40% -40% -40% -40%)", transform: "none" },
        },
        "drawer-in": { from: { transform: "translateX(100%)" }, to: { transform: "none" } },
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "15%": { transform: "translateX(-9px)" },
          "30%": { transform: "translateX(8px)" },
          "45%": { transform: "translateX(-6px)" },
          "60%": { transform: "translateX(5px)" },
          "75%": { transform: "translateX(-3px)" },
          "90%": { transform: "translateX(2px)" },
        },
        "digit-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(.5)" },
          "60%": { opacity: "1", transform: "translateY(-2px) scale(1.12)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "box-pop": { "0%": { transform: "scale(1)" }, "40%": { transform: "scale(1.08)" }, "100%": { transform: "scale(1)" } },
        "otp-wave": {
          "0%,100%": { transform: "translateY(0)", borderColor: "rgb(var(--line-strong))" },
          "50%": { transform: "translateY(-5px)", borderColor: "rgb(var(--accent))" },
        },
        "caret-blink": { "0%,45%": { opacity: "1" }, "50%,95%": { opacity: "0" }, "100%": { opacity: "1" } },
        "otp-collapse": { to: { opacity: "0", transform: "scale(.4)", filter: "blur(4px)" } },
        draw: { to: { strokeDashoffset: "0" } },
        burst: { "0%": { opacity: ".55", transform: "scale(.8)" }, "100%": { opacity: "0", transform: "scale(1.9)" } },
        "scale-in": { "0%": { opacity: "0", transform: "scale(.6)" }, "100%": { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
      },
      animation: {
        "fade-up": "fade-up .28s cubic-bezier(.2,.7,.2,1) both",
        "page-in": "page-in .55s cubic-bezier(.16,1,.3,1) both",
        "pop-in": "pop-in .22s cubic-bezier(.16,1,.3,1) both",
        "toast-in": "toast-in .45s cubic-bezier(.34,1.56,.64,1) both",
        "msg-in": "msg-in .32s cubic-bezier(.16,1,.3,1) both",
        "row-in": "row-in .5s cubic-bezier(.16,1,.3,1) both",
        print: "print .9s cubic-bezier(.16,1,.3,1) both",
        "drawer-in": "drawer-in .4s cubic-bezier(.16,1,.3,1) both",
        shake: "shake .55s cubic-bezier(.36,.07,.19,.97) both",
        "digit-in": "digit-in .38s cubic-bezier(.34,1.56,.64,1) both",
        "box-pop": "box-pop .3s cubic-bezier(.34,1.56,.64,1)",
        "otp-wave": "otp-wave .9s ease-in-out infinite",
        "caret-blink": "caret-blink 1.05s step-end infinite",
        "otp-collapse": "otp-collapse .45s cubic-bezier(.4,0,.2,1) forwards",
        draw: "draw .6s cubic-bezier(.65,0,.35,1) forwards",
        burst: "burst .8s cubic-bezier(.16,1,.3,1) forwards",
        "scale-in": "scale-in .5s cubic-bezier(.34,1.56,.64,1) both",
        "fade-in": "fade-in .3s ease both",
        marquee: "marquee var(--marquee-duration, 40s) linear infinite",
        blink: "blink 1.6s ease-in-out infinite",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
