'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  AppShell,
  Box,
  Burger,
  Button,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBox,
  IconHeartFilled,
  IconInfoCircle,
  IconSparkles,
  IconSword,
} from '@tabler/icons-react';

import {
  APP_NAME,
  ORACLE_NAME,
  ORACLE_TAGLINE,
  SUPPORT_URL,
} from '@/app/app.constants';
import { AdSlot } from '@/components/AdSlot';
import { WizdaGreeter } from '@/mascot/WizdaGreeter';

interface NavItem {
  href: string,
  label: string,
  icon: React.ReactNode,
  tooltip?: string,
}

const PRIMARY: NavItem = {
  href: '/',
  label: ORACLE_NAME,
  icon: <IconSparkles size={20} />,
  tooltip: ORACLE_TAGLINE,
};

const LISTS: NavItem[] = [
  {
    href: '/junks',
    label: 'Junk',
    icon: <IconBox size={20} />,
  },
  {
    href: '/equipment',
    label: 'Equipment',
    icon: <IconSword size={20} />,
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  // Desktop sidebar is minimized to the header button by default; the burger expands it.
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false);

  const renderLink = (item: NavItem) => {
    const link = (
      <NavLink
        key={item.href}
        component={Link}
        href={item.href}
        label={item.label}
        leftSection={item.icon}
        active={isActive(pathname, item.href)}
        onClick={closeMobile}
        variant="light"
      />
    );

    if (!item.tooltip) {
      return link;
    }

    return (
      <Tooltip
        key={item.href}
        label={item.tooltip}
        position="right"
        multiline
        w={220}
        withArrow
        openDelay={400}
      >
        <div>{link}</div>
      </Tooltip>
    );
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: {
          mobile: !mobileOpened,
          desktop: !desktopOpened,
        },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm" wrap="nowrap">
          <Burger
            opened={mobileOpened}
            onClick={toggleMobile}
            hiddenFrom="sm"
            size="sm"
            aria-label="Toggle navigation"
          />
          <Burger
            opened={desktopOpened}
            onClick={toggleDesktop}
            visibleFrom="sm"
            size="sm"
            aria-label="Toggle navigation"
          />
          <Link
            href="/"
            style={{ textDecoration: 'none' }}
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
              closeMobile();
              if (pathname === '/') {
                event.preventDefault();
                window.location.reload();
              }
            }}
          >
            <Title
              order={1}
              fz="1.5rem"
              c="crimson.5"
              style={{ letterSpacing: '0.08em' }}
            >
              {APP_NAME}
            </Title>
          </Link>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={4}>
            {renderLink(PRIMARY)}
            <Divider my="xs" label="Lists" labelPosition="left" />
            {LISTS.map(renderLink)}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Divider mb="sm" />
          <Stack gap="xs">
            <NavLink
              component={Link}
              href="/about"
              label="About"
              leftSection={<IconInfoCircle size={18} />}
              active={isActive(pathname, '/about')}
              onClick={closeMobile}
              variant="subtle"
            />
            <Button
              component="a"
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              variant="light"
              color="crimson"
              size="xs"
              leftSection={<IconHeartFilled size={16} />}
            >
              Support the project
            </Button>
            <Text size="xs" c="dimmed" ta="center">
              Keeps the lights on ✨
            </Text>
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        {/* Cap the content width so controls don't stretch on wide monitors. */}
        <Box maw={1100} mx="auto" w="100%">
          <WizdaGreeter />
          {children}
          <AdSlot />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
