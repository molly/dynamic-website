import express from 'express';
import { verifyRequestSignature } from '../helpers/security.js';

const router = express.Router();

router.get('/.well-known/webfinger', (req, res) => {
  if (!req.query.resource || !req.query.resource.startsWith('acct:')) {
    res
      .status(400)
      .send(
        "Bad request, please provide 'resource' query parameter with 'acct:' prefix.",
      );
  }
  if (req.query.resource === 'acct:molly@mollywhite.net') {
    res.json({
      subject: 'acct:molly@mollywhite.net',
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: 'https://mollywhite.net/ap/user/molly',
        },
      ],
    });
  } else {
    res.sendStatus(404);
  }
});

router.get('/ap/user/:id', (req, res) => {
  if (req.params.id === 'molly') {
    res.setHeader('Content-Type', 'application/activity+json');
    res.sendFile(new URL('../data/molly.json', import.meta.url).pathname);
  } else {
    res.sendStatus(404);
  }
});

router.get('/ap/inbox', verifyRequestSignature, (req, res) => {
  console.log(req.body);
});

export default router;
