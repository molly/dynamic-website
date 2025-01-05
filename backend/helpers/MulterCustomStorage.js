import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import urlencode from 'urlencode';
import { v4 as uuid } from 'uuid';

const MAX_DIMENSION = 1000;

// Sharp removes metadata by default, so an extra step to strip EXIF is not needed.
const resizeTransformer = sharp().resize({
  width: MAX_DIMENSION,
  height: MAX_DIMENSION,
  fit: sharp.fit.inside,
  withoutEnlargement: true,
});

export default class MulterGoogleCloudStorage {
  getFilename(req, file, cb) {
    if (typeof file.originalname === 'string') cb(null, file.originalname);
    else cb(null, `${uuid()}`);
  }

  getDestination(req, file, cb) {
    cb(null, '');
  }

  getContentType(req, file) {
    if (typeof file.mimetype === 'string') return file.mimetype;
    else return undefined;
  }

  getBlobFileReference(req, file) {
    const blobFile = {
      destination: '',
      filename: '',
    };

    this.getDestination(req, file, (err, destination) => {
      if (err) {
        return false;
      }
      var escDestination = '';
      escDestination += destination
        .replace(/^\.+/g, '')
        .replace(/^\/+|\/+$/g, '');
      if (escDestination !== '') {
        escDestination = escDestination + '/';
      }
      blobFile.destination = escDestination;
    });

    this.getFilename(req, file, (err, filename) => {
      if (err) {
        return false;
      }
      blobFile.filename = urlencode(
        filename
          .replace(/^\.+/g, '')
          .replace(/^\/+/g, '')
          .replace(/\r|\n/g, '_'),
      );
    });

    return blobFile;
  }

  constructor(opts) {
    this._handleFile = (req, file, cb) => {
      const blobFile = this.getBlobFileReference(req, file);
      if (blobFile !== false) {
        var blobName = blobFile.destination + blobFile.filename;
        var blob = this.gcsBucket.file(blobName);
        const streamOpts = {};
        if (!this.options.uniformBucketLevelAccess) {
          streamOpts.predefinedAcl = this.options.acl || 'private';
        }
        const contentType = this.getContentType(req, file);
        if (contentType) {
          streamOpts.metadata = { contentType };
        }
        const blobStream = blob.createWriteStream(streamOpts);
        file.stream
          .pipe(resizeTransformer)
          .pipe(blobStream)
          .on('error', (err) => cb(err))
          .on('finish', (_file) => {
            const name = blob.metadata.name;
            const filename = name.substr(name.lastIndexOf('/') + 1);
            cb(null, {
              bucket: blob.metadata.bucket,
              destination: blobFile.destination,
              filename,
              path: `${blobFile.destination}${filename}`,
              contentType: blob.metadata.contentType,
              size: blob.metadata.size,
              uri: `gs://${blob.metadata.bucket}/${blobFile.destination}${filename}`,
              linkUrl: `${this.gcsStorage.apiEndpoint}/${blob.metadata.bucket}/${blobFile.destination}${filename}`,
              selfLink: blob.metadata.selfLink,
            });
          });
      }
    };

    this._removeFile = (req, file, cb) => {
      const blobFile = this.getBlobFileReference(req, file);
      if (blobFile !== false) {
        var blobName = blobFile.destination + blobFile.filename;
        var blob = this.gcsBucket.file(blobName);
        blob.delete();
        cb();
      }
    };

    opts = opts || {};

    typeof opts.destination === 'string'
      ? (this.getDestination = function (req, file, cb) {
          cb(null, opts.destination);
        })
      : (this.getDestination = opts.destination || this.getDestination);

    if (opts.hideFilename) {
      this.getFilename = function (req, file, cb) {
        cb(null, `${uuid()}`);
      };
      this.getContentType = function (_req, _file) {
        return undefined;
      };
    } else {
      typeof opts.filename === 'string'
        ? (this.getFilename = function (req, file, cb) {
            cb(null, opts.filename);
          })
        : (this.getFilename = opts.filename || this.getFilename);
      typeof opts.contentType === 'string'
        ? (this.getContentType = function (_req, _file) {
            return opts.contentType;
          })
        : (this.getContentType = opts.contentType || this.getContentType);
    }

    const bucket = opts.bucket || process.env.GCS_BUCKET || null;
    const projectId = opts.projectId || process.env.GCLOUD_PROJECT || null;
    const keyFilename = opts.keyFilename || process.env.GCS_KEYFILE || null;
    if (!bucket) {
      throw new Error(
        'You have to specify bucket for Google Cloud Storage to work.',
      );
    }
    if (!projectId) {
      throw new Error(
        'You have to specify project id for Google Cloud Storage to work.',
      );
    }
    /*
     * If credentials and keyfile are not defined, Google Storage should appropriately be able to locate the
     * default credentials for the environment see: https://cloud.google.com/docs/authentication/application-default-credentials#search_order
     */
    this.gcsStorage = new Storage(
      Object.assign(Object.assign({}, opts), { projectId, keyFilename }),
    );
    this.gcsBucket = this.gcsStorage.bucket(bucket);
    this.options = opts;
  }
}

export function storageEngine(opts) {
  return new MulterGoogleCloudStorage(opts);
}
