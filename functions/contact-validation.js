function text(value,label,max,required=true) {
  if(typeof value!=='string') throw Error(`${label} is invalid.`);
  const result=value.trim();
  if((required&&!result)||result.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(result)) throw Error(`${label} is invalid.`);
  return result;
}
export function validateContact(data) {
  if(!data||typeof data!=='object'||Array.isArray(data)||data.website) throw Error('Unable to submit this form.');
  const name=text(data.name,'Name',120);
  const email=text(data.email,'Email address',254).toLowerCase();
  const subject=text(data.subject,'Subject',160);
  const phone=text(data.phone??'','Phone number',60,false);
  const message=text(data.message,'Message',5000);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Enter a valid email address.');
  if(/[\r\n]/.test(subject+name+phone)) throw Error('Name, phone and subject must each be on one line.');
  if(message.length<10) throw Error('Please enter a message of at least 10 characters.');
  const requestId=text(data.requestId,'Request',80);
  if(!/^[a-zA-Z0-9_-]+$/.test(requestId)) throw Error('Invalid request.');
  return {name,email,phone,subject,message,requestId};
}
