import axios from 'axios';
import httpSignature from 'http-signature';

const signature = {
  scheme: 'Signature',
  params: {
    keyId: 'http://127.0.0.1:3000/u/molly#key',
    algorithm: 'rsa-sha256',
    headers: ['(request-target)', 'date', 'host', 'content-type', 'digest'],
    signature:
      'sT+14QZguDwDOi5IuwE3IG+nfLyWWxJRIr55C19RWQpM1gpNhhYy3fI3Sx01dBG8Br8RA9FGG/k+sT3ZaIlLNp/QDN0z12cHDQUkCn+OEsh8oTMXVTa8VwLKHNDL/Jb7IqjgMNyHyNJplqnNC5tcqTuabBnv52yrJm1RfQByW1PRSl11HtX1iw8oWeIxeFVqLcc1NHBkB52HtCbeLB6gJpYW783FcU4UegpQ6wCJ2975NDDie7TJUxeNCuoA1uY1KCG9lug2tsDaxmb9HjDtXjEiCZDLQ27xCOHwS1WhlMQ8AqAj+DNPqr0yA1aSRrKVjwHKjp0A7EQ2BWJTEtwPEQ==',
  },
  signingString:
    '(request-target): post /ap/user/molly/inbox\n' +
    'date: Thu, 07 Mar 2024 18:07:16 GMT\n' +
    'host: localhost:5001\n' +
    'content-type: application/ld+json; profile="https://www.w3.org/ns/activitystreams"\n' +
    'digest: SHA-256=Q4amG6eOM68VowtfmWrrj1nHCxcowT0hKifaBIMGdUY=',
  algorithm: 'RSA-SHA256',
  keyId: 'http://127.0.0.1:3000/u/molly#key',
  opaque: undefined,
};
const publicKeyResp = axios
  .get(signature.params.keyId, {
    headers: { Accept: 'application/activity+json' },
  })
  .then((publicKeyResp) => {
    const publicKey = publicKeyResp.data.publicKey.publicKeyPem;
    console.log(httpSignature.verifySignature(signature, publicKey));
  });
