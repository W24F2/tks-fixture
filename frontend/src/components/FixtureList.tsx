"use client";

import { motion, type Variants } from "framer-motion";
import { FixtureGroup } from "@/types/fixture";
import { FixtureCard } from "./FixtureCard";
import { formatDate } from "@/lib/api";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Skeleton } from "./ui/Skeleton";

interface FixtureListProps {
  groups: FixtureGroup[];
  onToggleFavourite: (fixtureId: number, isFavourite: boolean) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

const dateGroupVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      staggerChildren: 0.05,
    },
  },
};

const dateHeaderVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

export function FixtureList({
  groups,
  onToggleFavourite,
  isLoading = false,
  emptyMessage = "No fixtures found",
}: FixtureListProps) {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
        role="status"
        aria-label="Loading fixtures"
      >
        {[...Array(5)].map((_, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}>
            <Card className="p-4">
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/4 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
                <div className="flex gap-4">
                  <Skeleton className="h-5 w-24 rounded" />
                  <Skeleton className="h-5 w-24 rounded" />
                  <Skeleton className="h-5 w-24 rounded" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    );
  }

  if (groups.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12 px-4"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground">No fixtures</h3>
        <p className="mt-1 text-muted-foreground">{emptyMessage}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {groups.map((group) => (
        <motion.section
          key={group.date}
          variants={dateGroupVariants}
          className="space-y-3"
        >
          <motion.div
            variants={dateHeaderVariants}
            className="flex items-center gap-3 px-1"
          >
            <motion.div
              layoutId={`date-line-${group.date}`}
              className="h-px flex-1 bg-border"
            />
            <span className="flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-full bg-muted text-sm font-medium text-foreground">
              <motion.span
                initial={{ scale: 0.8, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                className="text-primary"
              >
                📅
              </motion.span>
              {formatDate(group.date)}
              <Badge variant="secondary" className="ml-1">
                {group.fixtures.length} {group.fixtures.length === 1 ? "fixture" : "fixtures"}
              </Badge>
            </span>
            <motion.div
              layoutId={`date-line-${group.date}-end`}
              className="h-px flex-1 bg-border"
            />
          </motion.div>

          <motion.div
            variants={containerVariants}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            role="list"
            aria-label={`Fixtures for ${formatDate(group.date)}`}
          >
            {group.fixtures.map((fixture, fixtureIndex) => (
              <motion.div key={fixture.id} variants={itemVariants} role="listitem">
                <FixtureCard
                  fixture={fixture}
                  onToggleFavourite={onToggleFavourite}
                  index={fixtureIndex}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      ))}
    </motion.div>
  );
}