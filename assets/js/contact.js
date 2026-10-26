const form=document.querySelector('#contact-form');
if(form){
  const config=window.bookWebsiteContact||{};
  const local=['localhost','127.0.0.1'].includes(location.hostname);
  const active=config.enabled&&(!local||config.allowLocalSending);
  const button=form.querySelector('button[type=submit]');
  const feedback=form.querySelector('[role=status]');
  const note=document.querySelector('#contact-service-note');
  let requestId=crypto.randomUUID(),pendingPayload=null;
  button.disabled=!active;
  if(!active)note.textContent='Online messages are not available yet. Please call 224-225-9494 for assistance.';
  form.addEventListener('input',()=>{pendingPayload=null;requestId=crypto.randomUUID();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!active||button.disabled||!form.reportValidity())return;
    const value=name=>form.elements.namedItem(name).value.trim();
    const payload=pendingPayload||{name:value('name'),email:value('email'),phone:value('phone'),subject:value('subject'),message:value('message'),website:value('website'),requestId};
    pendingPayload=payload;
    button.disabled=true;form.setAttribute('aria-busy','true');
    feedback.dataset.error='false';feedback.textContent='Sending your message…';
    try{
      if(!/^https:\/\//.test(config.endpoint))throw Error('Online messages are not configured. Please call us.');
      const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:payload})});
      const body=await response.json();
      if(!response.ok||!body.result?.ok)throw Error(body.error?.message||'We could not send your message. Please try again or call us.');
      feedback.textContent=body.result.message;
      form.reset();requestId=crypto.randomUUID();pendingPayload=null;
    }catch(error){feedback.dataset.error='true';feedback.textContent=error.message||'Unable to send. Your entries are still here; please try again.';}
    finally{button.disabled=false;form.removeAttribute('aria-busy');}
  });
}
