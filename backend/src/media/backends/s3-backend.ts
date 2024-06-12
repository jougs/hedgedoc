/*
 * SPDX-FileCopyrightText: 2024 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Inject, Injectable } from '@nestjs/common';
import { Client } from 'minio';
import { URL } from 'url';

import mediaConfiguration, { MediaConfig } from '../../config/media.config';
import { MediaBackendError } from '../../errors/errors';
import { ConsoleLoggerService } from '../../logger/console-logger.service';
import { MediaBackend } from '../media-backend.interface';
import { BackendType } from './backend-type.enum';

@Injectable()
export class S3Backend implements MediaBackend {
  private config: MediaConfig['backend']['s3'];
  private client: Client;

  constructor(
    private readonly logger: ConsoleLoggerService,
    @Inject(mediaConfiguration.KEY)
    private mediaConfig: MediaConfig,
  ) {
    this.logger.setContext(S3Backend.name);
    if (this.mediaConfig.backend.use !== BackendType.S3) {
      return;
    }
    this.config = this.mediaConfig.backend.s3;
    const url = new URL(this.config.endPoint);
    const isSecure = url.protocol === 'https:';
    this.client = new Client({
      endPoint: url.hostname,
      port: this.determinePort(url),
      useSSL: isSecure,
      accessKey: this.config.accessKeyId,
      secretKey: this.config.secretAccessKey,
      pathStyle: this.config.pathStyle,
      region: this.config.region,
    });
  }

  private determinePort(url: URL): number | undefined {
    const port = parseInt(url.port);
    return isNaN(port) ? undefined : port;
  }

  async saveFile(uuid: string, buffer: Buffer): Promise<null> {
    try {
      await this.client.putObject(this.config.bucket, uuid, buffer);
      this.logger.log(`Uploaded file ${uuid}`, 'saveFile');
      return null;
    } catch (e) {
      this.logger.error((e as Error).message, (e as Error).stack, 'saveFile');
      throw new MediaBackendError(`Could not save file ${uuid} on S3`);
    }
  }

  async deleteFile(uuid: string, _: unknown): Promise<void> {
    try {
      await this.client.removeObject(this.config.bucket, uuid);
      this.logger.log(`Deleted uploaded file ${uuid}`, 'deleteFile');
    } catch (e) {
      this.logger.error((e as Error).message, (e as Error).stack, 'deleteFile');
      throw new MediaBackendError(`Could not delete '${uuid}' on S3`);
    }
  }

  async getFileUrl(uuid: string, _: unknown): Promise<string> {
    try {
      return await this.client.presignedGetObject(this.config.bucket, uuid);
    } catch (e) {
      this.logger.error((e as Error).message, (e as Error).stack, 'getFileUrl');
      throw new MediaBackendError(`Could not get URL for '${uuid}' on S3`);
    }
  }
}
