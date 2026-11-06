/* The page label is stable even when the shared property serves other games. */
(() => {
  'use strict';
  const measurementId='G-QXB7CHLEDT';
  if(location.protocol!=='https:' || ['localhost','127.0.0.1','[::1]'].includes(location.hostname) || navigator.doNotTrack==='1' || navigator.globalPrivacyControl===true) return;
  window.dataLayer=window.dataLayer||[];
  const gtag=function(){window.dataLayer.push(arguments);};
  gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
  gtag('js',new Date());
  gtag('config',measurementId,{
    page_title:'PolyTrack Lab',page_location:location.origin+location.pathname,page_referrer:'',
    send_page_view:true,allow_google_signals:false,allow_ad_personalization_signals:false,
    cookie_prefix:'polytrack_lab',ignore_referrer:true
  });
  const script=document.createElement('script');script.async=true;
  script.src='https://www.googletagmanager.com/gtag/js?id='+measurementId;
  script.referrerPolicy='no-referrer';document.head.append(script);
})();

/* The page label is the Lab envelope, never the contents of a save. */
