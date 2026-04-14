// CSS Module type declarations
declare module '*.module.css' {
  const styles: { [className: string]: string };
  export default styles;
}

declare module '*.module.scss' {
  const styles: { [className: string]: string };
  export default styles;
}

// Plain CSS side-effect imports (e.g. `import './globals.css'` in app/layout.tsx).
declare module '*.css';
declare module '*.scss';
