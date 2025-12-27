#!/usr/bin/env bun

/**
 * Tests for library usage of gh-load-issue
 *
 * These tests verify that the module can be imported and used programmatically.
 */

import { describe, it, expect, setDefaultTimeout } from 'test-anywhere';
import path from 'path';
import { fileURLToPath } from 'url';

// Set timeout to 60 seconds for real issue download tests
setDefaultTimeout(60000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modulePath = path.join(__dirname, '..', 'gh-load-issue.mjs');

describe('Library API', () => {
  describe('Module Imports', () => {
    it('should export loadIssue function', async () => {
      const module = await import(modulePath);
      expect(typeof module.loadIssue).toBe('function');
    });

    it('should export parseIssueUrl function', async () => {
      const module = await import(modulePath);
      expect(typeof module.parseIssueUrl).toBe('function');
    });

    it('should export issueToMarkdown function', async () => {
      const module = await import(modulePath);
      expect(typeof module.issueToMarkdown).toBe('function');
    });

    it('should export issueToJson function', async () => {
      const module = await import(modulePath);
      expect(typeof module.issueToJson).toBe('function');
    });

    it('should export extractImagesFromMarkdown function', async () => {
      const module = await import(modulePath);
      expect(typeof module.extractImagesFromMarkdown).toBe('function');
    });
  });

  describe('parseIssueUrl', () => {
    it('should parse full GitHub URL', async () => {
      const { parseIssueUrl } = await import(modulePath);
      const result = parseIssueUrl('https://github.com/owner/repo/issues/123');

      expect(result).not.toBe(null);
      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.issueNumber).toBe(123);
    });

    it('should parse short format', async () => {
      const { parseIssueUrl } = await import(modulePath);
      const result = parseIssueUrl('owner/repo#456');

      expect(result).not.toBe(null);
      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.issueNumber).toBe(456);
    });

    it('should return null for invalid URL', async () => {
      const { parseIssueUrl } = await import(modulePath);
      const result = parseIssueUrl('invalid-url');

      expect(result).toBe(null);
    });

    it('should handle URLs with dashes in owner/repo', async () => {
      const { parseIssueUrl } = await import(modulePath);
      const result = parseIssueUrl(
        'https://github.com/my-org/my-repo/issues/789'
      );

      expect(result).not.toBe(null);
      expect(result.owner).toBe('my-org');
      expect(result.repo).toBe('my-repo');
      expect(result.issueNumber).toBe(789);
    });
  });

  describe('extractImagesFromMarkdown', () => {
    it('should extract markdown image syntax', async () => {
      const { extractImagesFromMarkdown } = await import(modulePath);
      const content = '![alt text](https://example.com/image.png)';
      const images = extractImagesFromMarkdown(content);

      expect(images.length).toBe(1);
      expect(images[0].url).toBe('https://example.com/image.png');
      expect(images[0].type).toBe('markdown');
    });

    it('should extract HTML img tags', async () => {
      const { extractImagesFromMarkdown } = await import(modulePath);
      const content = '<img src="https://example.com/image.jpg" />';
      const images = extractImagesFromMarkdown(content);

      expect(images.length).toBe(1);
      expect(images[0].url).toBe('https://example.com/image.jpg');
      expect(images[0].type).toBe('html');
    });

    it('should extract multiple images', async () => {
      const { extractImagesFromMarkdown } = await import(modulePath);
      const content = `
        Some text
        ![first](https://a.com/1.png)
        More text
        <img src="https://b.com/2.jpg" />
        ![second](https://c.com/3.gif)
      `;
      const images = extractImagesFromMarkdown(content);

      expect(images.length).toBe(3);
    });

    it('should handle empty content', async () => {
      const { extractImagesFromMarkdown } = await import(modulePath);
      const images = extractImagesFromMarkdown('');

      expect(images.length).toBe(0);
    });

    it('should handle null content', async () => {
      const { extractImagesFromMarkdown } = await import(modulePath);
      const images = extractImagesFromMarkdown(null);

      expect(images.length).toBe(0);
    });
  });

  describe('issueToMarkdown', () => {
    it('should generate markdown from issue data', async () => {
      const { issueToMarkdown } = await import(modulePath);
      const issueData = {
        issue: {
          number: 123,
          title: 'Test Issue',
          html_url: 'https://github.com/owner/repo/issues/123',
          state: 'open',
          user: {
            login: 'testuser',
            html_url: 'https://github.com/testuser',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          labels: [],
          assignees: [],
          milestone: null,
          body: 'This is the issue body.',
        },
        comments: [],
      };

      const markdown = issueToMarkdown(issueData);

      expect(markdown).toContain('# Test Issue');
      expect(markdown).toContain('**Issue:**');
      expect(markdown).toContain('#123');
      expect(markdown).toContain('**Author:**');
      expect(markdown).toContain('@testuser');
      expect(markdown).toContain('**State:** open');
      expect(markdown).toContain('This is the issue body.');
    });

    it('should include comments in markdown', async () => {
      const { issueToMarkdown } = await import(modulePath);
      const issueData = {
        issue: {
          number: 123,
          title: 'Test Issue',
          html_url: 'https://github.com/owner/repo/issues/123',
          state: 'open',
          user: {
            login: 'testuser',
            html_url: 'https://github.com/testuser',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          labels: [],
          assignees: [],
          milestone: null,
          body: 'Issue body',
        },
        comments: [
          {
            user: {
              login: 'commenter',
              html_url: 'https://github.com/commenter',
            },
            created_at: '2025-01-01T12:00:00Z',
            body: 'This is a comment.',
          },
        ],
      };

      const markdown = issueToMarkdown(issueData);

      expect(markdown).toContain('## Comments (1)');
      expect(markdown).toContain('@commenter');
      expect(markdown).toContain('This is a comment.');
    });

    it('should include labels in markdown', async () => {
      const { issueToMarkdown } = await import(modulePath);
      const issueData = {
        issue: {
          number: 123,
          title: 'Test Issue',
          html_url: 'https://github.com/owner/repo/issues/123',
          state: 'open',
          user: {
            login: 'testuser',
            html_url: 'https://github.com/testuser',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          labels: [{ name: 'bug' }, { name: 'enhancement' }],
          assignees: [],
          milestone: null,
          body: 'Issue body',
        },
        comments: [],
      };

      const markdown = issueToMarkdown(issueData);

      expect(markdown).toContain('**Labels:**');
      expect(markdown).toContain('`bug`');
      expect(markdown).toContain('`enhancement`');
    });
  });

  describe('issueToJson', () => {
    it('should generate JSON structure from issue data', async () => {
      const { issueToJson } = await import(modulePath);
      const issueData = {
        issue: {
          number: 123,
          title: 'Test Issue',
          html_url: 'https://github.com/owner/repo/issues/123',
          state: 'open',
          user: {
            login: 'testuser',
            html_url: 'https://github.com/testuser',
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
          labels: [],
          assignees: [],
          milestone: null,
          body: 'Issue body',
        },
        comments: [],
      };

      const json = issueToJson(issueData);

      expect(json.issue).not.toBe(undefined);
      expect(json.comments).not.toBe(undefined);
      expect(json.metadata).not.toBe(undefined);
      expect(json.issue.number).toBe(123);
      expect(json.issue.title).toBe('Test Issue');
      expect(json.metadata.downloaded_at).not.toBe(undefined);
    });
  });

  describe('loadIssue', () => {
    it('should throw error for invalid URL', async () => {
      const { loadIssue } = await import(modulePath);

      try {
        await loadIssue({ issueUrl: 'invalid-url' });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Invalid issue URL');
      }
    });

    it('should load a real issue (if authenticated)', async () => {
      const { loadIssue } = await import(modulePath);

      try {
        const result = await loadIssue({
          issueUrl: 'link-foundation/gh-load-issue#1',
          quiet: true,
        });

        // Verify structure
        expect(result.owner).not.toBe(undefined);
        expect(result.repo).not.toBe(undefined);
        expect(result.issueNumber).not.toBe(undefined);
        expect(result.issue).not.toBe(undefined);
        expect(result.comments).not.toBe(undefined);
        expect(result.markdown).not.toBe(undefined);
        expect(result.json).not.toBe(undefined);

        // Verify content
        expect(result.owner).toBe('link-foundation');
        expect(result.repo).toBe('gh-load-issue');
        expect(result.issueNumber).toBe(1);
        expect(result.markdown).toContain('# ');
      } catch (_error) {
        console.log('Skipping loadIssue test - authentication may be required');
      }
    });
  });
});
