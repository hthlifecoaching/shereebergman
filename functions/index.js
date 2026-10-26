import {initializeApp} from 'firebase-admin/app';
import {getDatabase} from 'firebase-admin/database';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onInit} from 'firebase-functions/v2/core';
import {defineString,defineSecret} from 'firebase-functions/params';
import {createHash} from 'node:crypto';
import nodemailer from 'nodemailer';
import {validateContact} from './contact-validation.js';
import {contactMail} from './contact-email.js';
const databaseURL=defineString('BOOK_DATABASE_URL',{default:'https://hearttoheart-14e56-default-rtdb.firebaseio.com'});
const mailTo=defineString('BOOK_MAIL_TO',{default:'hthlifecoaching@gmail.com'});
const mailFrom=defineString('BOOK_MAIL_FROM');
const smtp=defineSecret('SMTP_URL');
let db;
onInit(()=>{initializeApp({databaseURL:databaseURL.value()});db=getDatabase();});
const options={region:'us-central1',invoker:'public',maxInstances:2,timeoutSeconds:60,secrets:[smtp]};
const hash=value=>createHash('sha256').update(value).digest('hex');
async function throttle(request,email){
  for(const [key,limit] of [[`ip:${request.rawRequest.ip||'unknown'}`,20],[`email:${email}`,5]]){
    const now=Date.now();
    const result=await db.ref(`bookContactRateLimits/${hash(key)}`).transaction(old=>{
      const current=old&&old.expiresAt>now?old:{count:0,expiresAt:now+3600000};
      if(current.count>=limit)return;
      return {...current,count:current.count+1};
    });
    if(!result.committed)throw new HttpsError('resource-exhausted','Too many messages. Please try again later.');
  }
}
async function deliver(ref,record){
  const lock=await ref.child('delivery').transaction(old=>{
    if(old?.status==='sent'||(old?.status==='sending'&&old.at>Date.now()-120000))return;
    return {status:'sending',at:Date.now()};
  });
  if(!lock.committed)return lock.snapshot.val()?.status==='sent';
  try{
    if(!mailFrom.value()||!smtp.value()||!mailTo.value())throw Error('Email is not configured');
    const mail=contactMail(record);
    const transport=nodemailer.createTransport(smtp.value(),{connectionTimeout:10000,socketTimeout:15000});
    await transport.sendMail({from:mailFrom.value(),to:mailTo.value(),replyTo:mail.replyTo,subject:mail.subject,text:mail.text,html:mail.html});
    await ref.child('delivery').set({status:'sent',at:Date.now()});return true;
  }catch{
    await ref.child('delivery').set({status:'failed',at:Date.now()});return false;
  }
}
export const submitBookContact=onCall(options,async request=>{
  let record;try{record=validateContact(request.data);}catch(error){throw new HttpsError('invalid-argument',error.message);}
  await throttle(request,record.email);
  const messageId=hash(record.email+record.requestId),ref=db.ref(`bookContactMessages/${messageId}`);
  const result=await ref.transaction(old=>old?undefined:{...record,source:'Book Website',createdAt:Date.now(),delivery:{status:'pending',at:Date.now()}});
  const saved=result.snapshot.val();
  if(!saved)throw new HttpsError('internal','Unable to save your message. Please try again.');
  const emailed=await deliver(ref,saved);
  return {ok:true,messageId,emailed,message:emailed?'Thank you. Your message has been received and emailed to Heart to Heart.':'Your message has been saved, but its email notification could not be delivered yet. Please call 224-225-9494 if you need a prompt reply.'};
});
export const retryBookContactEmail=onCall({...options,invoker:'private'},async request=>{
  if(!request.auth||(await db.ref(`admins/${request.auth.uid}`).get()).val()!==true)throw new HttpsError('permission-denied','Administrator access is required.');
  const id=request.data?.messageId;
  if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw new HttpsError('invalid-argument','Invalid message.');
  const ref=db.ref(`bookContactMessages/${id}`),record=(await ref.get()).val();
  if(!record)throw new HttpsError('not-found','Message not found.');
  return {ok:await deliver(ref,record)};
});
