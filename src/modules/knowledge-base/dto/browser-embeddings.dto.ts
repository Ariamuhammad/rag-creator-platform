import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BROWSER_EMBEDDING_DIMENSIONS } from '../../../common/browser-ai';

export class BrowserChunkEmbeddingDto {
  @IsUUID()
  id: string;

  @IsArray()
  @ArrayMinSize(BROWSER_EMBEDDING_DIMENSIONS)
  @ArrayMaxSize(BROWSER_EMBEDDING_DIMENSIONS)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  @Min(-1, { each: true })
  @Max(1, { each: true })
  embedding: number[];
}

export class BrowserEmbeddingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => BrowserChunkEmbeddingDto)
  chunks: BrowserChunkEmbeddingDto[];
}
