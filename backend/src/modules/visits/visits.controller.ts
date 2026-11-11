
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ACTIVE_VISIT_CONFLICT_MESSAGE, VisitsError, VisitsService } from './visits.service.js';

export class VisitsController {
  private service = new VisitsService();

  create = async (req: Request, res: Response) => {
    try {
      const visit = await this.service.create(req.body);
      res.status(201).json(visit);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const visit = await this.service.update(
        String(req.params.id),
        req.body
      );

      res.status(200).json(visit);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  findAll = async (req: Request, res: Response) => {
    try {
      const visits = await this.service.findAll(req.query);
      res.status(200).json(visits);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  findById = async (req: Request, res: Response) => {
    try {
      const visit = await this.service.findById(
        String(req.params.id)
      );

      res.status(200).json(visit);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  findByPatient = async (req: Request, res: Response) => {
    try {
      const visits = await this.service.findByPatient(
        String(req.params.patientId)
      );

      res.status(200).json(visits);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  findActivePatients = async (_req: Request, res: Response) => {
    try {
      const activePatients = await this.service.findActivePatients();
      res.status(200).json(activePatients);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  private handleError(res: Response, error: unknown) {
    if (error instanceof VisitsError) {
      res.status(error.statusCode).json({
        message: error.message
      });
      return;
    }

    if (error instanceof mongoose.Error.ValidationError ||
        error instanceof mongoose.Error.CastError) {
      res.status(400).json({
        message: error.message
      });
      return;
    }

    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({
        message: ACTIVE_VISIT_CONFLICT_MESSAGE
      });
      return;
    }

    console.error('Unexpected visits module error:', error);

    res.status(500).json({
      message: 'Internal server error'
    });
  }
}
