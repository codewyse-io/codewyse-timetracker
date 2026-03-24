import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { extname, join } from 'path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'fs';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly useLocal: boolean;
  private readonly localDir: string;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', '');
    this.appUrl = this.configService.get<string>('app.url', 'http://localhost:3000');

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.configService.get<string>('AWS_S3_REGION', 'us-east-1');

    // Use local filesystem when AWS credentials are not configured
    this.useLocal = !accessKeyId || !secretAccessKey;

    if (this.useLocal) {
      this.s3 = null;
      this.localDir = join(process.cwd(), 'uploads', 'storage');
      mkdirSync(this.localDir, { recursive: true });
      this.logger.warn('AWS credentials not configured — using local filesystem storage');
    } else {
      this.s3 = new S3Client({
        region,
        credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
      });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    const key = `${folder}/${uuidv4()}${extname(file.originalname)}`;

    if (this.useLocal) {
      const filePath = join(this.localDir, ...key.split('/'));
      mkdirSync(join(this.localDir, ...key.split('/').slice(0, -1)), { recursive: true });
      writeFileSync(filePath, file.buffer);
      this.logger.log(`Uploaded ${key} to local storage`);
      return key;
    }

    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    this.logger.log(`Uploaded ${key} to S3`);
    return key;
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.useLocal) {
      // Serve via the static file route
      return `${this.appUrl}/uploads/storage/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3!, command, { expiresIn });
  }

  async getObjectContent(key: string): Promise<string> {
    if (this.useLocal) {
      const filePath = join(this.localDir, ...key.split('/'));
      if (existsSync(filePath)) {
        return readFileSync(filePath, 'utf-8');
      }
      return '';
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const result = await this.s3!.send(command);
    return result.Body?.transformToString('utf-8') || '';
  }

  async listObjects(prefix: string): Promise<{ key: string; size: number; lastModified: Date }[]> {
    if (this.useLocal) {
      const dirPath = join(this.localDir, ...prefix.split('/'));
      if (!existsSync(dirPath)) return [];
      return readdirSync(dirPath).map((name) => {
        const stat = statSync(join(dirPath, name));
        return { key: `${prefix}/${name}`, size: stat.size, lastModified: stat.mtime };
      });
    }

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    });
    const result = await this.s3!.send(command);
    return (result.Contents || []).map((obj) => ({
      key: obj.Key!,
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    }));
  }
}
