"use client";

import { motion } from "framer-motion";
import { Skeleton } from "./ui/Skeleton";
import { Card } from "./ui/Card";

export function LoadingScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background flex flex-col"
    >
      <div className="container mx-auto px-4 py-6 flex-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Skeleton className="h-8 w-48 rounded mb-4" />
          <Skeleton className="h-4 w-64 rounded" />
        </motion.div>

        <div className="space-y-6" role="status" aria-label="Loading fixtures">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
            >
              <Card className="p-4">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-1/4 rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                  <div className="flex flex-wrap gap-4">
                    <Skeleton className="h-5 w-24 rounded" />
                    <Skeleton className="h-5 w-24 rounded" />
                    <Skeleton className="h-5 w-24 rounded" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 py-8 border-t text-center"
      >
        <Skeleton className="h-4 w-48 mx-auto rounded" />
      </motion.footer>
    </motion.div>
  );
}