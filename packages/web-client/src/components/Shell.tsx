'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { APP_NAME, ORACLE_NAME, SUPPORT_URL } from '@/app/app.constants';
import { AdSlot } from '@/components/AdSlot';
import { DataFreshness } from '@/components/DataFreshness';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLocaleHref, useStrings, useWizda } from '@/i18n/LanguageProvider';
import { stripLocale } from '@/i18n/locale';
import { WizdaGreeter } from '@/mascot/WizdaGreeter';
import {
    AppShell, Box, Burger, Button, Divider, Group, NavLink, ScrollArea, Stack, Text, Title, Tooltip
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
    IconBox, IconHeartFilled, IconInfoCircle, IconSparkles, IconSword
} from '@tabler/icons-react';

interface NavItem {
  href: string,
  label: string,
  icon: React.ReactNode,
  tooltip?: string,
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  // Nav items are declared with unprefixed paths (`/junks`) and rendered under
  // the active language by `localeHref`; route comparisons strip the prefix
  // back off, so neither has to know which language is showing.
  const pathname = stripLocale(usePathname());
  const localeHref = useLocaleHref();
  const strings = useStrings();
  const wizda = useWizda();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  // Desktop sidebar is minimized to the header button by default; the burger expands it.
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false);

  const primary: NavItem = {
    href: '/',
    label: ORACLE_NAME,
    icon: <IconSparkles size={20} />,
    tooltip: wizda.oracle.tagline,
  };

  const lists: NavItem[] = [
    {
      href: '/junks',
      label: strings.nav.junkLabel,
      icon: <IconBox size={20} />,
    },
    {
      href: '/equipment',
      label: strings.nav.equipmentLabel,
      icon: <IconSword size={20} />,
    },
  ];

  const renderLink = (item: NavItem) => {
    const link = (
      <NavLink
        key={item.href}
        component={Link}
        href={localeHref(item.href)}
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
            aria-label={strings.nav.toggleNavigationAriaLabel}
          />
          <Burger
            opened={desktopOpened}
            onClick={toggleDesktop}
            visibleFrom="sm"
            size="sm"
            aria-label={strings.nav.toggleNavigationAriaLabel}
          />
          <Link
            href={localeHref('/')}
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
          <DataFreshness />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={4}>
            {renderLink(primary)}
            <Divider my="xs" label={strings.nav.listsSectionLabel} labelPosition="left" />
            {lists.map(renderLink)}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Divider mb="sm" />
          <Stack gap="xs">
            <NavLink
              component={Link}
              href={localeHref('/about')}
              label={strings.nav.aboutLabel}
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
              {strings.nav.supportButtonLabel}
            </Button>
            <Text size="xs" c="dimmed" ta="center">
              {strings.nav.supportCaption}
            </Text>
            <Divider my={4} />
            <LanguageToggle />
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
