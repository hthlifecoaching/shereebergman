import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {validateContact} from '../functions/contact-validation.js';
import {contactMail} from '../functions/contact-email.js';
const input={name:'Jane Example',email:'JANE@example.com',phone:'',subject:'Book question',message:'I would like to learn about your books.',requestId:'request-123',website:''};
test('validates and normalizes the book contact without trusting recipient fields',()=>{
 const result=validateContact({...input,to:'attacker@example.com'});
 assert.equal(result.email,'jane@example.com');assert.equal(result.phone,'');assert.equal(result.to,undefined);
});
test('rejects invalid email, header injection, oversized messages, spam and invalid request identifiers',()=>{
 for(const patch of [{email:'bad'}, {subject:'Hi\r\nBcc: attacker@example.com'}, {message:'x'.repeat(5001)}, {message:'short'}, {website:'spam'}, {requestId:'a/b'}, {name:''}])assert.throws(()=>validateContact({...input,...patch}));
});
test('copies the existing notification style, labels Book Website, and includes all contact fields',()=>{
 const record=validateContact(input),mail=contactMail(record);
 assert.equal(mail.subject,'Book Website contact: Book question');assert.equal(mail.replyTo,'jane@example.com');
 for(const s of ['Book Website','Heart to Heart','Life Coaching','Contact details','Jane Example','Not provided','Message','Reply to sender','background:#65283b'])assert.ok(mail.html.includes(s),s);
 assert.ok(mail.html.includes('mailto:jane%40example.com?subject=Re%3A%20Book%20question'));
 assert.ok(!mail.html.includes('SUPPORT GROUP CONTACT'));assert.ok(!mail.html.includes('MAIN WEBSITE CONTACT'));
 assert.ok(mail.text.includes('Phone: Not provided'));
});
test('HTML notification escapes visitor markup and preserves message line breaks',()=>{
 const mail=contactMail({...input,name:'<img src=x onerror=alert(1)>',subject:'" onclick="bad',message:'<script>bad</script>\nA & B'});
 assert.ok(!mail.html.includes('<script>'));assert.ok(!mail.html.includes('<img'));
 assert.ok(mail.html.includes('&lt;script&gt;bad&lt;/script&gt;<br>A &amp; B'));
 assert.ok(mail.html.includes('&quot; onclick=&quot;bad'));
});
function frontend(fetchImpl,enabled=true){
 const handlers={},button={disabled:false},feedback={dataset:{},textContent:''},note={textContent:''};
 const controls=Object.fromEntries(Object.entries(input).map(([k,v])=>[k,{value:v}]));
 let resets=0,ids=0;
 const form={elements:{namedItem:n=>controls[n]},querySelector:s=>s==='button[type=submit]'?button:feedback,addEventListener:(n,fn)=>handlers[n]=fn,reportValidity:()=>true,setAttribute(){},removeAttribute(){},reset(){resets++;}};
 const context={document:{querySelector:s=>s==='#contact-form'?form:note},window:{bookWebsiteContact:{enabled,allowLocalSending:true,endpoint:'https://example.com/contact'}},location:{hostname:'127.0.0.1'},crypto:{randomUUID:()=>`request-${++ids}`},fetch:fetchImpl};
 vm.runInNewContext(readFileSync(new URL('../assets/js/contact.js',import.meta.url),'utf8'),context);
 return {handlers,button,feedback,controls,resets:()=>resets};
}
test('frontend sends the Firebase callable envelope and clears only after success',async()=>{
 let sent;
 const f=frontend(async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({result:{ok:true,message:'Received'}})};});
 await f.handlers.submit({preventDefault(){}});
 assert.equal(sent.data.name,input.name);assert.equal(sent.data.subject,input.subject);assert.equal(f.resets(),1);assert.equal(f.feedback.textContent,'Received');assert.equal(f.button.disabled,false);
});
test('frontend keeps entries and reuses the same identifier after network failure',async()=>{
 const requests=[];const f=frontend(async(url,options)=>{requests.push(JSON.parse(options.body));throw Error('Network unavailable');});
 await f.handlers.submit({preventDefault(){}});await f.handlers.submit({preventDefault(){}});
 assert.equal(f.resets(),0);assert.equal(f.controls.message.value,input.message);assert.equal(requests[0].data.requestId,requests[1].data.requestId);assert.equal(f.feedback.dataset.error,'true');assert.equal(f.button.disabled,false);
});
test('disabled configuration does not send a request',async()=>{
 let calls=0;const f=frontend(async()=>calls++,false);await f.handlers.submit({preventDefault(){}});assert.equal(calls,0);assert.equal(f.button.disabled,true);
});
