
import { Request, Response } from 'express';
import { PatientsService } from './patients.service.js';

export class PatientsController {
  private service = new PatientsService();

  create = async (req: Request, res: Response) => {
    try {
      const patient = await this.service.create(req.body);
      res.status(201).json(patient);
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message
      });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const patient = await this.service.update(
        String(req.params.id),
        req.body
      );

      res.status(200).json(patient);
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message
      });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      await this.service.delete(String(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(404).json({
        message: (error as Error).message
      });
    }
  };

  findAll = async (_req: Request, res: Response) => {
    try {
      const patients = await this.service.findAll();
      res.status(200).json(patients);
    } catch (error) {
      res.status(500).json({
        message: (error as Error).message
      });
    }
  };

  findById = async (req: Request, res: Response) => {
    try {
      const patient = await this.service.findById(
        String(req.params.id)
      );

      res.status(200).json(patient);
    } catch (error) {
      res.status(404).json({
        message: (error as Error).message
      });
    }
  };

  findByCpf = async (req: Request, res: Response) => {
    try {
      const patient = await this.service.findByCpf(
        String(req.params.cpf)
      );

      res.status(200).json(patient);
    } catch (error) {
      res.status(404).json({
        message: (error as Error).message
      });
    }
  };
}