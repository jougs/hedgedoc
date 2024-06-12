/*
 * SPDX-FileCopyrightText: 2024 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Inject, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

import mediaConfiguration, { MediaConfig } from '../../config/media.config';
import { MediaBackendError } from '../../errors/errors';
import { ConsoleLoggerService } from '../../logger/console-logger.service';
import { MediaBackend } from '../media-backend.interface';

@Injectable()
export class FilesystemBackend implements MediaBackend {
  private readonly uploadDirectory;

  constructor(
    private readonly logger: ConsoleLoggerService,
    @Inject(mediaConfiguration.KEY)
    private mediaConfig: MediaConfig,
  ) {
    this.logger.setContext(FilesystemBackend.name);
    this.uploadDirectory = this.mediaConfig.backend.filesystem.uploadPath;
  }

  async saveFile(uuid: string, buffer: Buffer): Promise<null> {
    const filePath = this.getFilePath(uuid);
    this.logger.debug(`Writing uploaded file to '${filePath}'`, 'saveFile');
    await this.ensureDirectory();
    try {
      await fs.writeFile(filePath, buffer, null);
      return null;
    } catch (e) {
      this.logger.error((e as Error).message, (e as Error).stack, 'saveFile');
      throw new MediaBackendError(`Could not save file '${filePath}'`);
    }
  }

  async deleteFile(uuid: string, _: unknown): Promise<void> {
    const filePath = this.getFilePath(uuid);
    try {
      return await fs.unlink(filePath);
    } catch (e) {
      this.logger.error((e as Error).message, (e as Error).stack, 'deleteFile');
      throw new MediaBackendError(`Could not delete file '${filePath}'`);
    }
  }

  getFileUrl(uuid: string, _: unknown): Promise<string> {
    return Promise.resolve(`/uploads/${uuid}`);
  }

  private getFilePath(fileName: string): string {
    return join(this.uploadDirectory, fileName);
  }

  private async ensureDirectory(): Promise<void> {
    this.logger.debug(
      `Ensuring presence of directory at ${this.uploadDirectory}`,
      'ensureDirectory',
    );
    try {
      await fs.access(this.uploadDirectory);
    } catch (e) {
      try {
        this.logger.debug(
          `The directory '${this.uploadDirectory}' can't be accessed. Trying to create the directory`,
          'ensureDirectory',
        );
        await fs.mkdir(this.uploadDirectory);
      } catch (e) {
        this.logger.error(
          (e as Error).message,
          (e as Error).stack,
          'ensureDirectory',
        );
        throw new MediaBackendError(
          `Could not create '${this.uploadDirectory}'`,
        );
      }
    }
  }
}
