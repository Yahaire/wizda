import { ShareButton } from '@/components/ShareButton';
import { Group, Title } from '@mantine/core';

interface PageTitleProps {
  children: React.ReactNode,
  /**
   * Adds a share button beside the title. Only meaningful on a page whose URL
   * is worth handing to someone — leave it off a page nobody would send anyone
   * to on its own (About).
   */
  shareable?: boolean,
}

/**
 * Every page's `<h2>`, with an optional share button — see `ShareButton`.
 *
 * The button sits immediately beside the title rather than pushed to the far
 * edge (`justify="space-between"`), which on a wide desktop content column left
 * it stranded far enough from the heading to read as unrelated page chrome and
 * be missed entirely. Hugging the title says "share *this*", and keeps one
 * layout across every screen size instead of a breakpoint rule to maintain.
 */
export function PageTitle({ children, shareable }: PageTitleProps) {
  return (
    <Group gap="xs" wrap="nowrap" align="center">
      <Title order={2}>{children}</Title>
      {shareable && <ShareButton />}
    </Group>
  );
}
