'use client';

import {
  makeStyles,
  shorthands,
} from '@griffel/react';
import {
  Title3,
} from '@fluentui/react-text';
import {
  Image,
} from '@fluentui/react-image';
import {
  Card,
  CardHeader,
} from '@fluentui/react-card';

const useStyles = makeStyles({
  card: {
    ...shorthands.margin('20px'),
  },
  imageContainer: {
    display: 'flex',
    justifyContent: 'center',
    ...shorthands.padding('20px'),
  },
});

export const ArchitectureDiagram = () => {
  const styles = useStyles();

  return (
    <Card className={styles.card}>
      <CardHeader header={<Title3>System Architecture</Title3>} />
      <div className={styles.imageContainer}>
        {/* Placeholder for actual architecture diagram */}
        <Image
          src="https://via.placeholder.com/800x400?text=The+Things+Stack+on+Azure+Architecture"
          alt="Architecture Diagram"
          fit="contain"
        />
      </div>
    </Card>
  );
};
