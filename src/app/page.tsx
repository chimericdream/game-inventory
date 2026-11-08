import { Container, Text, Title } from '@mantine/core';

export default function HomePage() {
  return (
    <Container py="xl">
      <Title order={1}>Game Library</Title>
      <Text c="dimmed">Scaffold is up. Catalog coming next.</Text>
    </Container>
  );
}
