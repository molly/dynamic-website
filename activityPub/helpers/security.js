import axios from 'axios';
import httpSignature from 'http-signature';
import crypto from 'node:crypto';
import fs from 'node:fs';

// Verify signatures on incoming requests
// TODO: Verify staleness
export const verifyRequestSignature = async (req, res, next) => {
  console.log('verifying');
  console.log(req.url);
  const signature = httpSignature.parseRequest(req);
  console.log(signature);
  if (!signature) {
    res.status(401).send({ message: 'No signature' });
  }
  const keyId = signature.params.keyId;

  const publicKeyResp = await axios.get(keyId, {
    headers: { Accept: 'application/activity+json' },
  });
  const publicKey = publicKeyResp.data.publicKey.publicKeyPem;
  if (!httpSignature.verifySignature(signature, publicKey)) {
    console.log('invalid signature');
    res.status(401).send({ message: 'Invalid signature' });
    return;
  } else {
    console.log('valid!');
    next();
  }
};

export const sign = (message, destination) => {
  const destinationUrl = new URL(destination);
  let destinationServer = destinationUrl.hostname;
  if (destinationServer.port) {
    destinationServer += `:${destinationServer.port}`;
  }
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(message))
    .digest('base64');
  const signer = crypto.createSign('sha256');
  const now = new Date();
  const headersString = `(request-target): post ${destinationServer}/inbox\nhost: ${destinationServer}\ndate: ${now.toUTCString()}\ndigest: SHA-256=${hash}`;
  signer.update(headersString);
  signer.end();

  const privateKey = fs.readFileSync(
    new URL(`../config/private.pem`, import.meta.url),
  );
  const signature = signer.sign(privateKey);
  const signatureB64 = signature.toString('base64');
  const me =
    process.argv[2] === 'prod'
      ? 'https://www.mollywhite.net/ap/user/molly'
      : 'http://localhost:5001/ap/user/molly';
  const headerSignature = `keyId="${me}",headers="(request-target) host date digest",signature="${signatureB64}"`;
  return {
    Host: destinationServer,
    Date: now.toUTCString(),
    Digest: `SHA-256=${hash}`,
    Signature: headerSignature,
  };
};

export const intercept = (req, res, next) => {
  console.log(req.headers);
  console.log(req.path);
  next();
};
