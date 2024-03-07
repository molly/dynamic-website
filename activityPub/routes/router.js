import express from 'express';
import { intercept, verifyRequestSignature } from '../helpers/security.js';

const router = express.Router();
router.use(intercept);

router.get('/.well-known/webfinger', (req, res) => {
  if (!req.query.resource || !req.query.resource.startsWith('acct:')) {
    res
      .status(400)
      .send(
        "Bad request, please provide 'resource' query parameter with 'acct:' prefix.",
      );
  }
  if (
    req.query.resource === 'acct:molly@mollywhite.net' ||
    req.query.resource === 'acct:molly@localhost:5001'
  ) {
    res.setHeader('Content-Type', 'application/activity+json');
    res.json({
      subject: 'acct:molly@mollywhite.net',
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href:
            process.argv[2] !== 'prod'
              ? 'http://localhost:5001/ap/user/molly'
              : 'https://www.mollywhite.net/ap/user/molly',
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
    res.sendFile(
      new URL(
        `../data/molly${process.argv[2] !== 'prod' ? '-local' : ''}.json`,
        import.meta.url,
      ).pathname,
    );
  } else {
    res.sendStatus(404);
  }
});

router.post('/ap/inbox', verifyRequestSignature, (req, res) => {
  console.log(req.body);
  console.log(req);
});

router.post('/ap/user/molly/inbox', verifyRequestSignature, (req, res) => {
  console.log(req.body);
  console.log(req);
});

export default router;
