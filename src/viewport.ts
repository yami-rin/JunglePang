import {deviceType} from './platform';

/** Capture CSS-pixel geometry; mobile browser chrome must not move the controls. */
export function bindViewport(): () => void {
  const root=document.documentElement;
  const mobile=deviceType(navigator.userAgent,navigator.maxTouchPoints,(navigator as Navigator & {userAgentData?:{mobile:boolean}}).userAgentData?.mobile)==='mobile';
  const abort=new AbortController();
  const options={signal:abort.signal};
  let width=0, height=0;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  let focusFrame=0;

  const availableHeight=()=>{
    if (window.visualViewport && Math.abs(window.visualViewport.scale-1)>.01) return;
    const visible=Math.min(height,window.visualViewport?.height ?? window.innerHeight);
    root.style.setProperty('--available-height',`${Math.max(1,Math.floor(visible))}px`);
    const active=document.activeElement;
    const editing=active instanceof HTMLElement && active.matches('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]),textarea');
    const keyboard=mobile && editing && visible<height-80;
    root.toggleAttribute('data-keyboard-open',keyboard);
    cancelAnimationFrame(focusFrame);
    if(keyboard) focusFrame=requestAnimationFrame(()=>active!.scrollIntoView({block:'nearest'}));
  };
  const capture=()=>{
    resizeTimer=undefined;
    // Layout width is stable while the visual viewport is being pinch-zoomed.
    width=Math.max(1,document.documentElement.clientWidth);
    height=Math.max(1,window.innerHeight);
    root.style.setProperty('--viewport-width',`${width}px`);
    root.style.setProperty('--viewport-height',`${height}px`);
    availableHeight();
  };
  const scheduleCapture=()=>{
    clearTimeout(resizeTimer);
    // Rotation can deliver width and height in separate resize events.
    resizeTimer=setTimeout(capture,100);
  };
  const resize=()=>{
    if(!mobile || root.clientWidth!==width || resizeTimer!==undefined) scheduleCapture();
    availableHeight();
  };

  capture();
  window.addEventListener('resize',resize,options);
  window.screen.orientation?.addEventListener('change',scheduleCapture,options);
  window.addEventListener('orientationchange',scheduleCapture,options);
  window.addEventListener('pageshow',event=>{if(event.persisted) scheduleCapture();},options);
  window.visualViewport?.addEventListener('resize',availableHeight,options);
  document.addEventListener('focusin',availableHeight,options);
  document.addEventListener('focusout',()=>queueMicrotask(availableHeight),options);
  return ()=>{
    abort.abort();
    clearTimeout(resizeTimer);
    cancelAnimationFrame(focusFrame);
  };
}
