export interface EbookChapter {
  idx: number;
  title: string;
  contentMd: string;
}

export interface EbookData {
  title: string;
  subtitle?: string;
  author: string;
  chapters: EbookChapter[];
}
