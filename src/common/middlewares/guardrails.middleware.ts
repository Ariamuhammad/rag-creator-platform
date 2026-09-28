import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class GuardrailsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(GuardrailsMiddleware.name);

  // Common prompt injection & jailbreak patterns
  private readonly injectionPatterns: RegExp[] = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
    /disregard\s+(all\s+)?(previous|prior|above)\s+instructions/i,
    /bypass\s+(your\s+)?(safety\s+)?filters/i,
    /reveal\s+(your\s+)?(system\s+)?prompt/i,
    /what\s+(is|are)\s+your\s+(initial\s+)?instructions/i,
    /you\s+are\s+now\s+in\s+developer\s+mode/i,
    /dan\s+mode/i,
    /act\s+as\s+(an\s+)?unrestricted\s+ai/i,
    /forget\s+everything\s+you\s+know/i,
    /repeat\s+(everything|the\s+text)\s+above/i,
  ];

  // PII Regex Patterns
  private readonly emailRegex =
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
  private readonly phoneRegex =
    /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4,6})\b/g;
  private readonly creditCardRegex =
    /\b(?:\d{4}[ -]?){3}\d{4}\b/g;

  use(req: Request, res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      const promptText = req.body.message || req.body.prompt || req.body.query;

      if (promptText && typeof promptText === 'string') {
        // 1. Anti-Prompt Injection Detection
        for (const pattern of this.injectionPatterns) {
          if (pattern.test(promptText)) {
            this.logger.warn(
              `Prompt injection attempt detected: "${promptText.slice(0, 80)}..."`,
            );
            throw new BadRequestException(
              'Security Guardrail: Input rejected due to potential prompt injection or policy violation.',
            );
          }
        }

        // 2. PII Masking
        let sanitizedText = promptText;

        // Mask emails: john.doe@example.com -> j***e@example.com
        sanitizedText = sanitizedText.replace(this.emailRegex, (email) => {
          const [user, domain] = email.split('@');
          if (user.length <= 2) return `**@${domain}`;
          return `${user[0]}***${user[user.length - 1]}@${domain}`;
        });

        // Mask credit cards
        sanitizedText = sanitizedText.replace(
          this.creditCardRegex,
          '****-****-****-****',
        );

        // Mask phone numbers
        sanitizedText = sanitizedText.replace(this.phoneRegex, '[PHONE REDACTED]');

        // Update sanitized text back to the request body
        if (req.body.message) req.body.message = sanitizedText;
        if (req.body.prompt) req.body.prompt = sanitizedText;
        if (req.body.query) req.body.query = sanitizedText;
      }
    }

    next();
  }
}
