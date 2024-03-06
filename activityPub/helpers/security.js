
import httpSignature from 'http-signature';

// Verify signatures on incoming requests
export const verifyRequestSignature(req, res, next) => {
  const signature = httpSignature.parseRequest(req);
  if (!signature) {
    res.status(401).send({ message: 'No signature' });
  }
  const keyId = signature.params.keyId;

  const publicKey = await axios.get(keyId, {headers: {Accept: 'application/activity+json'}})
  if (!httpSignature.verifySignature(signature, publicKey)) {
    res.status(401).send({ message: 'Invalid signature' });
  } else {
    next();
  }
}