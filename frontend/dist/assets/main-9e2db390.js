import{j as e,u as t,Q as r,a as s}from"./ui-580b099c.js";import{a,r as i,R as o}from"./vendor-79b9f383.js";!function(){const e=document.createElement("link").relList;if(!(e&&e.supports&&e.supports("modulepreload"))){for(const e of document.querySelectorAll('link[rel="modulepreload"]'))t(e);new MutationObserver(e=>{for(const r of e)if("childList"===r.type)for(const e of r.addedNodes)"LINK"===e.tagName&&"modulepreload"===e.rel&&t(e)}).observe(document,{childList:!0,subtree:!0})}function t(e){if(e.ep)return;e.ep=!0;const t=function(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),"use-credentials"===e.crossOrigin?t.credentials="include":"anonymous"===e.crossOrigin?t.credentials="omit":t.credentials="same-origin",t}(e);fetch(e.href,t)}}();var n={},l=a;n.createRoot=l.createRoot,n.hydrateRoot=l.hydrateRoot;let c,d,u,p={data:""},m=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,f=/\/\*[^]*?\*\/|  +/g,h=/\n+/g,g=(e,t)=>{let r="",s="",a="";for(let i in e){let o=e[i];"@"==i[0]?"i"==i[1]?r=i+" "+o+";":s+="f"==i[1]?g(o,i):i+"{"+g(o,"k"==i[1]?"":t)+"}":"object"==typeof o?s+=g(o,t?t.replace(/([^,])+/g,e=>i.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):i):null!=o&&(i=/^--/.test(i)?i:i.replace(/[A-Z]/g,"-$&").toLowerCase(),a+=g.p?g.p(i,o):i+":"+o+";")}return r+(t&&a?t+"{"+a+"}":a)+s},y={},b=e=>{if("object"==typeof e){let t="";for(let r in e)t+=r+b(e[r]);return t}return e};function x(e){let t=this||{},r=e.call?e(t.p):e;return((e,t,r,s,a)=>{let i=b(e),o=y[i]||(y[i]=(e=>{let t=0,r=11;for(;t<e.length;)r=101*r+e.charCodeAt(t++)>>>0;return"go"+r})(i));if(!y[o]){let t=i!==e?e:(e=>{let t,r,s=[{}];for(;t=m.exec(e.replace(f,""));)t[4]?s.shift():t[3]?(r=t[3].replace(h," ").trim(),s.unshift(s[0][r]=s[0][r]||{})):s[0][t[1]]=t[2].replace(h," ").trim();return s[0]})(e);y[o]=g(a?{["@keyframes "+o]:t}:t,r?"":"."+o)}let n=r&&y.g?y.g:null;return r&&(y.g=y[o]),l=y[o],c=t,d=s,(u=n)?c.data=c.data.replace(u,l):-1===c.data.indexOf(l)&&(c.data=d?l+c.data:c.data+l),o;var l,c,d,u})(r.unshift?r.raw?((e,t,r)=>e.reduce((e,s,a)=>{let i=t[a];if(i&&i.call){let e=i(r),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;i=t?"."+t:e&&"object"==typeof e?e.props?"":g(e,""):!1===e?"":e}return e+s+(null==i?"":i)},""))(r,[].slice.call(arguments,1),t.p):r.reduce((e,r)=>Object.assign(e,r&&r.call?r(t.p):r),{}):r,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||p})(t.target),t.g,t.o,t.k)}x.bind({g:1});let v=x.bind({k:1});function w(e,t){let r=this||{};return function(){let s=arguments;function a(i,o){let n=Object.assign({},i),l=n.className||a.className;r.p=Object.assign({theme:d&&d()},n),r.o=/ *go\d+/.test(l),n.className=x.apply(r,s)+(l?" "+l:""),t&&(n.ref=o);let p=e;return e[0]&&(p=n.as||e,delete n.as),u&&p[0]&&u(n),c(p,n)}return t?t(a):a}}var E=(e,t)=>(e=>"function"==typeof e)(e)?e(t):e,j=(()=>{let e=0;return()=>(++e).toString()})(),k=(()=>{let e;return()=>{if(void 0===e&&typeof window<"u"){let t=matchMedia("(prefers-reduced-motion: reduce)");e=!t||t.matches}return e}})(),_="default",N=(e,t)=>{let{toastLimit:r}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,r)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:s}=t;return N(e,{type:e.toasts.find(e=>e.id===s.id)?1:0,toast:s});case 3:let{toastId:a}=t;return{...e,toasts:e.toasts.map(e=>e.id===a||void 0===a?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let i=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+i}))}}},L=[],R={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},A={},O=(e,t=_)=>{A[t]=N(A[t]||R,e),L.forEach(([e,r])=>{e===t&&r(A[t])})},P=e=>Object.keys(A).forEach(t=>O(e,t)),$=(e=_)=>t=>{O(t,e)},T={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},I=e=>(t,r)=>{let s=((e,t="blank",r)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...r,id:(null==r?void 0:r.id)||j()}))(t,e,r);return $(s.toasterId||(e=>Object.keys(A).find(t=>A[t].toasts.some(t=>t.id===e)))(s.id))({type:2,toast:s}),s.id},C=(e,t)=>I("blank")(e,t);C.error=I("error"),C.success=I("success"),C.loading=I("loading"),C.custom=I("custom"),C.dismiss=(e,t)=>{let r={type:3,toastId:e};t?$(t)(r):P(r)},C.dismissAll=e=>C.dismiss(void 0,e),C.remove=(e,t)=>{let r={type:4,toastId:e};t?$(t)(r):P(r)},C.removeAll=e=>C.remove(void 0,e),C.promise=(e,t,r)=>{let s=C.loading(t.loading,{...r,...null==r?void 0:r.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let a=t.success?E(t.success,e):void 0;return a?C.success(a,{id:s,...r,...null==r?void 0:r.success}):C.dismiss(s),e}).catch(e=>{let a=t.error?E(t.error,e):void 0;a?C.error(a,{id:s,...r,...null==r?void 0:r.error}):C.dismiss(s)}),e};var D,S,z,M,q=(e,t="default")=>{let{toasts:r,pausedAt:s}=((e={},t=_)=>{let[r,s]=i.useState(A[t]||R),a=i.useRef(A[t]);i.useEffect(()=>(a.current!==A[t]&&s(A[t]),L.push([t,s]),()=>{let e=L.findIndex(([e])=>e===t);e>-1&&L.splice(e,1)}),[t]);let o=r.toasts.map(t=>{var r,s,a;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(r=e[t.type])?void 0:r.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(s=e[t.type])?void 0:s.duration)||(null==e?void 0:e.duration)||T[t.type],style:{...e.style,...null==(a=e[t.type])?void 0:a.style,...t.style}}});return{...r,toasts:o}})(e,t),a=i.useRef(new Map).current,o=i.useCallback((e,t=1e3)=>{if(a.has(e))return;let r=setTimeout(()=>{a.delete(e),n({type:4,toastId:e})},t);a.set(e,r)},[]);i.useEffect(()=>{if(s)return;let e=Date.now(),a=r.map(r=>{if(r.duration===1/0)return;let s=(r.duration||0)+r.pauseDuration-(e-r.createdAt);if(!(s<0))return setTimeout(()=>C.dismiss(r.id,t),s);r.visible&&C.dismiss(r.id)});return()=>{a.forEach(e=>e&&clearTimeout(e))}},[r,s,t]);let n=i.useCallback($(t),[t]),l=i.useCallback(()=>{n({type:5,time:Date.now()})},[n]),c=i.useCallback((e,t)=>{n({type:1,toast:{id:e,height:t}})},[n]),d=i.useCallback(()=>{s&&n({type:6,time:Date.now()})},[s,n]),u=i.useCallback((e,t)=>{let{reverseOrder:s=!1,gutter:a=8,defaultPosition:i}=t||{},o=r.filter(t=>(t.position||i)===(e.position||i)&&t.height),n=o.findIndex(t=>t.id===e.id),l=o.filter((e,t)=>t<n&&e.visible).length;return o.filter(e=>e.visible).slice(...s?[l+1]:[0,l]).reduce((e,t)=>e+(t.height||0)+a,0)},[r]);return i.useEffect(()=>{r.forEach(e=>{if(e.dismissed)o(e.id,e.removeDelay);else{let t=a.get(e.id);t&&(clearTimeout(t),a.delete(e.id))}})},[r,o]),{toasts:r,handlers:{updateHeight:c,startPause:l,endPause:d,calculateOffset:u}}},F=v`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,U=v`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,H=v`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,B=w("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${F} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${U} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${H} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,V=v`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,K=w("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${V} 1s linear infinite;
`,W=v`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,G=v`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,J=w("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${W} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${G} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,Q=w("div")`
  position: absolute;
`,Y=w("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,Z=v`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,X=w("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${Z} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,ee=({toast:e})=>{let{icon:t,type:r,iconTheme:s}=e;return void 0!==t?"string"==typeof t?i.createElement(X,null,t):t:"blank"===r?null:i.createElement(Y,null,i.createElement(K,{...s}),"loading"!==r&&i.createElement(Q,null,"error"===r?i.createElement(B,{...s}):i.createElement(J,{...s})))},te=e=>`\n0% {transform: translate3d(0,${-200*e}%,0) scale(.6); opacity:.5;}\n100% {transform: translate3d(0,0,0) scale(1); opacity:1;}\n`,re=e=>`\n0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}\n100% {transform: translate3d(0,${-150*e}%,-1px) scale(.6); opacity:0;}\n`,se=w("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,ae=w("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,ie=i.memo(({toast:e,position:t,style:r,children:s})=>{let a=e.height?((e,t)=>{let r=e.includes("top")?1:-1,[s,a]=k()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[te(r),re(r)];return{animation:t?`${v(s)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${v(a)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(e.position||t||"top-center",e.visible):{opacity:0},o=i.createElement(ee,{toast:e}),n=i.createElement(ae,{...e.ariaProps},E(e.message,e));return i.createElement(se,{className:e.className,style:{...a,...r,...e.style}},"function"==typeof s?s({icon:o,message:n}):i.createElement(i.Fragment,null,o,n))});D=i.createElement,g.p=S,c=D,d=z,u=M;var oe=({id:e,className:t,style:r,onHeightUpdate:s,children:a})=>{let o=i.useCallback(t=>{if(t){let r=()=>{let r=t.getBoundingClientRect().height;s(e,r)};r(),new MutationObserver(r).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,s]);return i.createElement("div",{ref:o,className:t,style:r},a)},ne=x`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,le=({reverseOrder:e,position:t="top-center",toastOptions:r,gutter:s,children:a,toasterId:o,containerStyle:n,containerClassName:l})=>{let{toasts:c,handlers:d}=q(r,o);return i.createElement("div",{"data-rht-toaster":o||"",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...n},className:l,onMouseEnter:d.startPause,onMouseLeave:d.endPause},c.map(r=>{let o=r.position||t,n=((e,t)=>{let r=e.includes("top"),s=r?{top:0}:{bottom:0},a=e.includes("center")?{justifyContent:"center"}:e.includes("right")?{justifyContent:"flex-end"}:{};return{left:0,right:0,display:"flex",position:"absolute",transition:k()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${t*(r?1:-1)}px)`,...s,...a}})(o,d.calculateOffset(r,{reverseOrder:e,gutter:s,defaultPosition:t}));return i.createElement(oe,{id:r.id,key:r.id,onHeightUpdate:d.updateHeight,className:r.visible?ne:"",style:n},"custom"===r.type?E(r.message,r):a?a(r):i.createElement(ie,{toast:r,position:o}))}))},ce=C;const de={},ue=function(e,t,r){if(!t||0===t.length)return e();const s=document.getElementsByTagName("link");return Promise.all(t.map(e=>{if((e=function(e){return"/"+e}(e))in de)return;de[e]=!0;const t=e.endsWith(".css"),a=t?'[rel="stylesheet"]':"";if(!!r)for(let r=s.length-1;r>=0;r--){const a=s[r];if(a.href===e&&(!t||"stylesheet"===a.rel))return}else if(document.querySelector(`link[href="${e}"]${a}`))return;const i=document.createElement("link");return i.rel=t?"stylesheet":"modulepreload",t||(i.as="script",i.crossOrigin=""),i.href=e,document.head.appendChild(i),t?new Promise((t,r)=>{i.addEventListener("load",t),i.addEventListener("error",()=>r(new Error(`Unable to preload CSS for ${e}`)))}):void 0})).then(()=>e()).catch(e=>{const t=new Event("vite:preloadError",{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e})},pe={sm:"h-4 w-4 border-2",md:"h-8 w-8 border-2",lg:"h-12 w-12 border-3",xl:"h-16 w-16 border-4"},me={primary:"border-primary border-t-transparent",secondary:"border-secondary border-t-transparent",white:"border-white border-t-transparent"},fe=({size:t="md",variant:r="primary",className:s="",message:a})=>e.jsxs("div",{className:`flex flex-col items-center justify-center gap-3 ${s}`,children:[e.jsx("div",{className:`\n          animate-spin rounded-full\n          ${pe[t]} \n          ${me[r]}\n        `,role:"status","aria-live":"polite","aria-label":"Loading",children:e.jsx("span",{className:"sr-only",children:"Loading..."})}),a&&e.jsx("p",{className:"text-sm text-gray-400 animate-pulse",children:a})]});var he=Object.defineProperty,ge=(e,t,r)=>(((e,t,r)=>{t in e?he(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r})(e,"symbol"!=typeof t?t+"":t,r),r);const ye=e=>e.replace(/\/+$/,""),be=(()=>{const e={}.VITE_API_URL?.trim();if(e)return ye(e);if("undefined"!=typeof window){const{location:e}=window;if("localhost"===e.hostname&&"4173"===e.port)return"http://localhost:8000/api/v1";if("localhost"===e.hostname&&("5173"===e.port||"3000"===e.port))return"/api/v1"}return"/api/v1"})();const xe=new class{constructor(e=be){ge(this,"baseURL"),ge(this,"maxRetries",3),ge(this,"retryDelays",[1e3,2e3,4e3]),this.baseURL=ye(e)}isRetriableError(e,t){return t?503===t.status||502===t.status||504===t.status:e instanceof Error&&("AbortError"===e.name||e.message.includes("Failed to fetch")||e.message.includes("Network request failed")||e.message.includes("timeout"))}async delay(e){return new Promise(t=>setTimeout(t,e))}async request(e,t={}){let r=null;for(let a=0;a<=this.maxRetries;a++){const i=`${this.baseURL}${e}`,o=new AbortController,n=setTimeout(()=>o.abort(),1e4),l={headers:{"Content-Type":"application/json",...t.headers},signal:o.signal,...t};try{const e=await fetch(i,l);if(clearTimeout(n),!e.ok){let t=`HTTP ${e.status}: ${e.statusText}`;try{const r=await e.json();t=r.detail||r.message||t}catch{}if(this.isRetriableError(null,e)&&a<this.maxRetries){await this.delay(this.retryDelays[a]||1e3);continue}if(e.status>=500)throw new Error("SabiScore backend returned an internal error. Ensure the backend service is running (./START_SABISCORE.bat) and reachable at the configured API URL.");throw new Error(t)}return await e.json()}catch(s){if(clearTimeout(n),r=s instanceof Error?s:new Error("An unexpected error occurred"),this.isRetriableError(s)&&a<this.maxRetries){await this.delay(this.retryDelays[a]||1e3);continue}if("AbortError"===r.name)throw new Error("Request timeout");if(r.message.includes("Failed to fetch"))throw new Error("Unable to connect to server. Please check if the backend is running.");throw r}}throw r||new Error("An unexpected error occurred")}async healthCheck(){return this.request("/health")}async searchMatches(e,t){const r=new URLSearchParams({q:e});return t&&r.append("league",t),this.request(`/matches/search?${r}`)}async generateInsights(e,t="EPL"){return this.request("/insights",{method:"POST",body:JSON.stringify({matchup:e,league:t})})}},ve=i.lazy(()=>ue(()=>import("./MatchSelector-782cb300.js"),["assets/MatchSelector-782cb300.js","assets/ui-580b099c.js","assets/vendor-79b9f383.js","assets/SafeImage-50a8612a.js"])),we=i.lazy(()=>ue(()=>import("./InsightsDisplay-31197151.js"),["assets/InsightsDisplay-31197151.js","assets/ui-580b099c.js","assets/vendor-79b9f383.js","assets/charts-7dda3064.js"])),Ee=i.lazy(()=>ue(()=>import("./ErrorScreen-6bd6515a.js"),["assets/ErrorScreen-6bd6515a.js","assets/ui-580b099c.js","assets/vendor-79b9f383.js"])),je=i.lazy(()=>ue(()=>import("./Header-91024901.js"),["assets/Header-91024901.js","assets/ui-580b099c.js","assets/vendor-79b9f383.js","assets/SafeImage-50a8612a.js"])),ke=i.lazy(()=>ue(()=>import("./ErrorBoundary-43e2972d.js"),["assets/ErrorBoundary-43e2972d.js","assets/ui-580b099c.js","assets/vendor-79b9f383.js"])),_e=i.lazy(()=>ue(()=>import("./LoadingCard-47960a6c.js"),["assets/LoadingCard-47960a6c.js","assets/ui-580b099c.js","assets/vendor-79b9f383.js"])),Ne=()=>e.jsx("div",{className:"min-h-screen bg-app-surface flex items-center justify-center",children:e.jsx(fe,{size:"lg",variant:"primary",message:"Loading application..."})});function Le(){const[r,s]=i.useState(null),[a,o]=i.useState(null),n=i.useRef(null),l=i.useRef(!1),c=i.useRef(!1),{isLoading:d,error:u}=t({queryKey:["health"],queryFn:()=>xe.healthCheck(),retry:(e,t)=>t instanceof Error&&t.message.includes("Failed to fetch")?e<2:e<3,retryDelay:e=>Math.min(1e3*2**e,3e4),staleTime:3e5}),{data:p,isLoading:m,isFetching:f,error:h,refetch:g}=t({queryKey:["insights",r?.matchup,r?.league],queryFn:async()=>{if(!r)throw new Error("No matchup selected");try{return await xe.generateInsights(r.matchup,r.league)}catch(e){throw e}},enabled:!!r,retry:(e,t)=>!(t instanceof Error&&t.message.includes("400"))&&(t instanceof Error&&t.message.includes("timeout")?e<1:e<2),retryDelay:e=>Math.min(1e3*2**e,5e3)});i.useEffect(()=>{p&&n.current!==p.generated_at&&(n.current=p.generated_at,o(p),C.success("Insights generated successfully!"))},[p]),i.useEffect(()=>{h&&(l.current||(l.current=!0,C.error("Failed to generate insights. Please try again.")))},[h]),i.useEffect(()=>{u?c.current||(c.current=!0,C.error("Failed to connect to backend. Please check if the server is running.")):c.current=!1},[u]),i.useEffect(()=>{h||(l.current=!1)},[h]);return d?e.jsx("div",{className:"min-h-screen bg-app-surface flex items-center justify-center",children:e.jsx(fe,{size:"xl",variant:"primary",message:"Connecting to server..."})}):u?e.jsx(i.Suspense,{fallback:e.jsx(Ne,{}),children:e.jsx(Ee,{onRetry:()=>window.location.reload()})}):e.jsxs("div",{className:"min-h-screen bg-app-surface text-slate-100",children:[e.jsx(i.Suspense,{fallback:e.jsx(Ne,{}),children:e.jsxs(ke,{children:[e.jsx(je,{}),e.jsx("main",{className:"container mx-auto px-4 py-8",children:e.jsxs("div",{className:"max-w-4xl mx-auto space-y-8",children:[e.jsx(ve,{onMatchSelect:({matchup:e,league:t})=>{o(null),s({matchup:e,league:t})}}),(m||f)&&e.jsx(i.Suspense,{fallback:e.jsx("div",{className:"glass-card p-8",children:e.jsx(fe,{size:"lg"})}),children:e.jsx(_e,{variant:"enhanced",title:"Analyzing Match Data",message:"Our AI is processing thousands of data points to generate your insights..."})}),h&&e.jsx("div",{className:"glass-card p-8 border-red-500/20 animate-fade-in",children:e.jsxs("div",{className:"text-center space-y-4",children:[e.jsx("div",{className:"inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-2",children:e.jsx("svg",{className:"w-8 h-8 text-red-400",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"})})}),e.jsx("h3",{className:"text-xl font-semibold text-red-400",children:"Generation Failed"}),e.jsx("p",{className:"text-gray-300 max-w-md mx-auto",children:"Unable to generate insights for this matchup. This could be due to insufficient data or a temporary server issue."}),e.jsxs("button",{onClick:()=>{r&&g()},className:"btn-primary inline-flex items-center gap-2",children:[e.jsx("svg",{className:"w-5 h-5",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"})}),"Try Again"]})]})}),a&&!m&&e.jsx(we,{insights:a})]})})]})}),e.jsx(le,{position:"top-right"})]})}const Re=new r({defaultOptions:{queries:{staleTime:3e5,gcTime:6e5}}});n.createRoot(document.getElementById("root")).render(e.jsx(o.StrictMode,{children:e.jsxs(s,{client:Re,children:[e.jsx(Le,{}),e.jsx(le,{position:"top-right",toastOptions:{duration:4e3,style:{background:"rgba(255, 255, 255, 0.1)",backdropFilter:"blur(12px)",border:"1px solid rgba(255, 255, 255, 0.2)",color:"#ffffff"}}})]})}));export{fe as L,ce as z};
