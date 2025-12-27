#!/usr/bin/env bun

/**
 * Tests for image extraction and validation functionality
 */

import { describe, it, expect } from 'test-anywhere';

describe('Image Extraction', () => {
  describe('Markdown image extraction', () => {
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

    it('should extract simple markdown image', () => {
      const input = '![alt text](https://example.com/image.png)';
      const matches = [];
      let match;
      while ((match = markdownImageRegex.exec(input)) !== null) {
        matches.push(match[2]);
      }
      expect(matches).toEqual(['https://example.com/image.png']);
    });

    it('should extract image without alt text', () => {
      markdownImageRegex.lastIndex = 0;
      const input = '![](https://example.com/no-alt.jpg)';
      const matches = [];
      let match;
      while ((match = markdownImageRegex.exec(input)) !== null) {
        matches.push(match[2]);
      }
      expect(matches).toEqual(['https://example.com/no-alt.jpg']);
    });

    it('should extract image with title', () => {
      markdownImageRegex.lastIndex = 0;
      const input =
        '![with title](https://example.com/titled.gif "Title here")';
      const matches = [];
      let match;
      while ((match = markdownImageRegex.exec(input)) !== null) {
        matches.push(match[2]);
      }
      expect(matches).toEqual(['https://example.com/titled.gif']);
    });

    it('should extract multiple images from text', () => {
      markdownImageRegex.lastIndex = 0;
      const input =
        'Text before ![first](https://a.com/1.png) middle ![second](https://b.com/2.jpg) after';
      const matches = [];
      let match;
      while ((match = markdownImageRegex.exec(input)) !== null) {
        matches.push(match[2]);
      }
      expect(matches).toEqual(['https://a.com/1.png', 'https://b.com/2.jpg']);
    });

    it('should extract GitHub user-images URLs', () => {
      markdownImageRegex.lastIndex = 0;
      const input =
        '![GitHub uploaded](https://user-images.githubusercontent.com/123/456-789.png)';
      const matches = [];
      let match;
      while ((match = markdownImageRegex.exec(input)) !== null) {
        matches.push(match[2]);
      }
      expect(matches).toEqual([
        'https://user-images.githubusercontent.com/123/456-789.png',
      ]);
    });
  });

  describe('HTML image extraction', () => {
    const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi;

    it('should extract self-closing img tag', () => {
      const input = '<img src="https://example.com/image.png" />';
      const matches = [];
      let match;
      while ((match = htmlImageRegex.exec(input)) !== null) {
        matches.push(match[1]);
      }
      expect(matches).toEqual(['https://example.com/image.png']);
    });

    it('should extract img tag with alt attribute', () => {
      htmlImageRegex.lastIndex = 0;
      const input = '<img src="https://example.com/image.jpg" alt="test">';
      const matches = [];
      let match;
      while ((match = htmlImageRegex.exec(input)) !== null) {
        matches.push(match[1]);
      }
      expect(matches).toEqual(['https://example.com/image.jpg']);
    });

    it('should extract img tag with single quotes', () => {
      htmlImageRegex.lastIndex = 0;
      const input =
        "<img alt='test' src='https://example.com/single-quotes.gif'>";
      const matches = [];
      let match;
      while ((match = htmlImageRegex.exec(input)) !== null) {
        matches.push(match[1]);
      }
      expect(matches).toEqual(['https://example.com/single-quotes.gif']);
    });

    it('should extract multiple img tags', () => {
      htmlImageRegex.lastIndex = 0;
      const input =
        '<p><img src="https://a.com/1.png" /></p><img src="https://b.com/2.jpg">';
      const matches = [];
      let match;
      while ((match = htmlImageRegex.exec(input)) !== null) {
        matches.push(match[1]);
      }
      expect(matches).toEqual(['https://a.com/1.png', 'https://b.com/2.jpg']);
    });
  });

  describe('Magic bytes validation', () => {
    it('should detect PNG magic bytes', () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const bytes = [...pngBuffer.slice(0, 12)];
      const isPng =
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47;
      expect(isPng).toBe(true);
    });

    it('should detect JPEG magic bytes', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const bytes = [...jpegBuffer.slice(0, 12)];
      const isJpeg =
        bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      expect(isJpeg).toBe(true);
    });

    it('should detect GIF magic bytes', () => {
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      const bytes = [...gifBuffer.slice(0, 12)];
      const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
      expect(isGif).toBe(true);
    });

    it('should detect HTML error pages', () => {
      const htmlBuffer = Buffer.from('<!DOCTYPE html><html>');
      const htmlText = htmlBuffer.toString('utf8').trim().toLowerCase();
      const isHtml =
        htmlText.includes('<!doctype html') || htmlText.includes('<html');
      expect(isHtml).toBe(true);
    });
  });

  describe('URL replacement in markdown', () => {
    it('should replace URL with local path', () => {
      const escapeRegex = (string) =>
        string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const originalUrl = 'https://example.com/image.png?token=abc123';
      const localPath = 'issue-1-images/image-1.png';
      const content = `Here is an image: ![alt](${originalUrl}) and more text`;

      const markdownRegex = new RegExp(
        `(!\\[[^\\]]*\\]\\()${escapeRegex(originalUrl)}((?:\\s+"[^"]*")?\\))`,
        'g'
      );

      const replaced = content.replace(markdownRegex, `$1${localPath}$2`);

      expect(replaced).toContain(localPath);
      expect(replaced).not.toContain(originalUrl);
    });
  });

  describe('File extension mapping', () => {
    it('should have correct extension format', () => {
      const extensions = {
        png: '.png',
        jpeg: '.jpg',
        gif: '.gif',
        webp: '.webp',
        bmp: '.bmp',
        ico: '.ico',
        svg: '.svg',
      };

      for (const [type, ext] of Object.entries(extensions)) {
        expect(ext.startsWith('.')).toBe(true);
        expect(type.length).toBeGreaterThan(0);
      }
    });
  });
});
